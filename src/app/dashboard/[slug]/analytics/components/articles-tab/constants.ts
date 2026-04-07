import type { Column } from './types'

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_COLUMNS: Column[] = [
  { key: 'ingestDate', label: 'Ingest Date', enabled: true, exportable: true, width: 'sm' },
  { key: 'finalPosition', label: 'Pos', enabled: true, exportable: true, width: 'xs' },
  { key: 'feedType', label: 'Section', enabled: true, exportable: true, width: 'md' },
  { key: 'feedName', label: 'Feed Name', enabled: false, exportable: true, width: 'md' },
  { key: 'originalTitle', label: 'Original Title', enabled: true, exportable: true, width: 'lg' },
  { key: 'originalDescription', label: 'Original Description', enabled: false, exportable: true, width: 'xl' },
  { key: 'originalFullText', label: 'Original Full Text', enabled: false, exportable: true, width: 'xl' },
  { key: 'publicationDate', label: 'Pub Date', enabled: false, exportable: true, width: 'sm' },
  { key: 'author', label: 'Author', enabled: false, exportable: true, width: 'md' },
  { key: 'sourceName', label: 'Source', enabled: true, exportable: true, width: 'md' },
  { key: 'sourceUrl', label: 'Source URL', enabled: false, exportable: true, width: 'xs' },
  { key: 'imageUrl', label: 'Image', enabled: false, exportable: true, width: 'xs' },
  { key: 'totalScore', label: 'Score', enabled: true, exportable: true, width: 'xs' },
  { key: 'criteria1Score', label: 'C1', enabled: true, exportable: true, width: 'xs' },
  { key: 'criteria1Weight', label: 'C1 Wt', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria1Reasoning', label: 'C1 Reasoning', enabled: false, exportable: true, width: 'xl' },
  { key: 'criteria2Score', label: 'C2', enabled: true, exportable: true, width: 'xs' },
  { key: 'criteria2Weight', label: 'C2 Wt', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria2Reasoning', label: 'C2 Reasoning', enabled: false, exportable: true, width: 'xl' },
  { key: 'criteria3Score', label: 'C3', enabled: true, exportable: true, width: 'xs' },
  { key: 'criteria3Weight', label: 'C3 Wt', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria3Reasoning', label: 'C3 Reasoning', enabled: false, exportable: true, width: 'xl' },
  { key: 'criteria4Score', label: 'C4', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria4Weight', label: 'C4 Wt', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria4Reasoning', label: 'C4 Reasoning', enabled: false, exportable: true, width: 'xl' },
  { key: 'criteria5Score', label: 'C5', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria5Weight', label: 'C5 Wt', enabled: false, exportable: true, width: 'xs' },
  { key: 'criteria5Reasoning', label: 'C5 Reasoning', enabled: false, exportable: true, width: 'xl' },
]
