import type { RssFeed } from '@/types/database'
import {
  type RSSProcessorContext,
  createDefaultContext,
  detectAIRefusal as _detectAIRefusal,
  AI_REFUSAL_PATTERNS
} from './shared-context'
import { Scoring } from './scoring'
import { FeedIngestion } from './feed-ingestion'
import { Deduplication } from './deduplication'
import { ArticleGenerator } from './article-generator'
import { ArticleSelector } from './article-selector'
import { ArticleExtraction } from './article-extraction'
import { StepWorkflow } from './step-workflow'
import { ModuleArticles } from './module-articles'
import { IssueLifecycle } from './issue-lifecycle'
import { Legacy } from './legacy'
import { Utils } from './utils'

/**
 * Thin facade that delegates to focused module classes.
 * All 30+ callers continue to use `new RSSProcessor().method()` unchanged.
 */
export class RSSProcessor {
  private ctx: RSSProcessorContext
  private scoring: Scoring
  private feedIngestion: FeedIngestion
  private deduplication: Deduplication
  private articleGenerator: ArticleGenerator
  private articleSelector: ArticleSelector
  private articleExtraction: ArticleExtraction
  private stepWorkflow: StepWorkflow
  private moduleArticles: ModuleArticles
  private issueLifecycle: IssueLifecycle
  private legacy: Legacy
  private utils: Utils

  // Keep static field for backward compatibility with tests
  private static readonly AI_REFUSAL_PATTERNS = AI_REFUSAL_PATTERNS

  constructor() {
    this.ctx = createDefaultContext()

    // Initialize modules in dependency order
    this.scoring = new Scoring()
    this.feedIngestion = new FeedIngestion(this.ctx, this.scoring)
    this.deduplication = new Deduplication()
    this.articleGenerator = new ArticleGenerator(this.ctx)
    this.articleSelector = new ArticleSelector()
    this.articleExtraction = new ArticleExtraction(this.ctx)
    this.stepWorkflow = new StepWorkflow(this.articleGenerator)
    this.moduleArticles = new ModuleArticles(this.articleGenerator)
    this.issueLifecycle = new IssueLifecycle(
      this.ctx,
      this.deduplication,
      this.articleGenerator,
      this.articleSelector
    )
    this.legacy = new Legacy(
      this.ctx,
      this.scoring,
      this.deduplication,
      this.articleGenerator,
      this.articleSelector,
      this.articleExtraction
    )
    this.utils = new Utils()

    // Wire up cross-module reference (avoids circular import)
    this.stepWorkflow.setLegacy(this.legacy)
  }

  // === Static methods ===

  static detectAIRefusal(content: string): string | null {
    return _detectAIRefusal(content)
  }

  // === Feed Ingestion ===

  ingestNewPosts() {
    return this.feedIngestion.ingestNewPosts()
  }

  // === Scoring ===

  scorePostsForSection(issueId: string, section: 'primary' | 'secondary' = 'primary') {
    return this.scoring.scorePostsForSection(issueId, section)
  }

  // === Deduplication ===

  handleDuplicatesForissue(issueId: string) {
    return this.deduplication.handleDuplicatesForIssue(issueId)
  }

  // === Article Generation ===

  generateArticlesForSection(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {
    return this.articleGenerator.generateArticlesForSection(issueId, section, limit)
  }

  // === Article Selection ===

  selectTopArticlesForissue(issueId: string) {
    return this.articleSelector.selectTopArticlesForIssue(issueId)
  }

  generateSubjectLineForissue(issueId: string) {
    return this.articleSelector.generateSubjectLineForIssue(issueId)
  }

  // === Article Extraction ===

  extractFullArticleText(issueId: string) {
    return this.articleExtraction.enrichRecentPostsWithFullContent(issueId)
  }

  // === Step-based Workflow ===

  processSingleFeed(feed: RssFeed, issueId: string, section: 'primary' | 'secondary' = 'primary') {
    return this.stepWorkflow.processSingleFeed(feed, issueId, section)
  }

  generateTitlesOnly(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 6) {
    return this.stepWorkflow.generateTitlesOnly(issueId, section, limit)
  }

  generateBodiesOnly(issueId: string, section: 'primary' | 'secondary' = 'primary', offset: number = 0, limit: number = 3) {
    return this.stepWorkflow.generateBodiesOnly(issueId, section, offset, limit)
  }

  factCheckArticles(issueId: string, section: 'primary' | 'secondary' = 'primary') {
    return this.stepWorkflow.factCheckArticles(issueId, section)
  }

  // === Issue Lifecycle ===

  processAllFeeds() {
    return this.issueLifecycle.processAllFeeds()
  }

  processAllFeedsHybrid() {
    return this.issueLifecycle.processAllFeedsHybrid()
  }

  unassignUnusedPosts(issueId: string) {
    return this.issueLifecycle.unassignUnusedPosts(issueId)
  }

  // === Module Articles ===

  assignPostsToModule(issueId: string, moduleId: string) {
    return this.moduleArticles.assignPostsToModule(issueId, moduleId)
  }

  generateTitlesForModule(issueId: string, moduleId: string) {
    return this.moduleArticles.generateTitlesForModule(issueId, moduleId)
  }

  generateBodiesForModule(issueId: string, moduleId: string, offset: number = 0, limit: number = 3) {
    return this.moduleArticles.generateBodiesForModule(issueId, moduleId, offset, limit)
  }

  factCheckArticlesForModule(issueId: string, moduleId: string) {
    return this.moduleArticles.factCheckArticlesForModule(issueId, moduleId)
  }

  selectTopArticlesForModule(issueId: string, moduleId: string) {
    return this.moduleArticles.selectTopArticlesForModule(issueId, moduleId)
  }

  getActiveArticleModules(publicationId: string) {
    return this.moduleArticles.getActiveArticleModules(publicationId)
  }

  // === Utils ===

  generateWelcomeSection(issueId: string) {
    return this.utils.generateWelcomeSection(issueId)
  }

  populateEventsForIssueSmart(issueId: string) {
    return this.utils.populateEventsForIssueSmart(issueId)
  }

  populateEventsForissue(issueId: string) {
    return this.utils.populateEventsForIssue(issueId)
  }

  // === Legacy (deprecated) ===

  processAllFeedsForissue(issueId: string) {
    return this.legacy.processAllFeedsForIssue(issueId)
  }
}
