drop extension if exists "pg_net";

create type "public"."section_type" as enum ('primary_articles', 'secondary_articles', 'welcome', 'ai_applications', 'prompt_ideas', 'advertorial', 'poll', 'breaking_news', 'beyond_the_feed', 'custom', 'sparkloop_recommendations');


  create table "public"."ad_block_types" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "label" text not null,
    "description" text,
    "default_config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."ad_module_advertisers" (
    "id" uuid not null default gen_random_uuid(),
    "ad_module_id" uuid not null,
    "advertiser_id" uuid not null,
    "display_order" integer not null default 1,
    "next_ad_position" integer not null default 1,
    "times_used" integer not null default 0,
    "priority" integer not null default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."ad_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "selection_mode" text default 'sequential'::text,
    "block_order" jsonb default '["title", "image", "body", "button"]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "next_position" integer default 1
      );



  create table "public"."ad_pricing_tiers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "frequency" text not null,
    "min_quantity" integer not null,
    "max_quantity" integer,
    "price_per_unit" numeric not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."advertisements" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid,
    "title" text not null,
    "body" text not null,
    "word_count" integer,
    "image_url" text,
    "frequency" text not null,
    "times_paid" integer default 0,
    "times_used" integer default 0,
    "status" text not null default 'pending_payment'::text,
    "display_order" integer,
    "paid" boolean default false,
    "preferred_start_date" date,
    "actual_start_date" date,
    "last_used_date" date,
    "payment_intent_id" text,
    "payment_amount" numeric,
    "payment_status" text,
    "submission_date" timestamp with time zone default now(),
    "approved_by" text,
    "approved_at" timestamp with time zone,
    "rejection_reason" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "button_text" text not null,
    "button_url" text not null,
    "clerk_user_id" text,
    "company_name" text,
    "ad_type" text default 'main_sponsor'::text,
    "preview_image_url" text,
    "ad_module_id" uuid,
    "advertiser_id" uuid,
    "priority" integer default 0,
    "image_alt" character varying(200)
      );



  create table "public"."advertisers" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "company_name" text not null,
    "contact_email" text,
    "contact_name" text,
    "logo_url" text,
    "website_url" text,
    "notes" text,
    "last_used_date" date,
    "times_used" integer default 0,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."ai_app_block_types" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "label" text not null,
    "description" text,
    "default_config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."ai_app_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "selection_mode" text default 'affiliate_priority'::text,
    "block_order" jsonb default '["title", "description", "button"]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "apps_count" integer default 6,
    "max_per_category" integer default 3,
    "affiliate_cooldown_days" integer default 7,
    "next_position" integer default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "layout_mode" text default 'inline'::text,
    "logo_style" text default 'square'::text,
    "title_size" text default 'medium'::text,
    "description_size" text default 'medium'::text,
    "block_config" jsonb default '{"logo": {"style": "square", "enabled": true, "position": "left"}, "image": {"enabled": false}, "title": {"size": "medium", "enabled": true}, "tagline": {"size": "medium", "enabled": false}, "description": {"size": "medium", "enabled": true}}'::jsonb,
    "show_in_directory" boolean default true,
    "show_emoji" boolean default true,
    "show_numbers" boolean default true,
    "include_in_archive" boolean default true
      );


alter table "public"."ai_app_modules" enable row level security;


  create table "public"."ai_applications" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid not null,
    "app_name" text not null,
    "tagline" text,
    "description" text not null,
    "category" text,
    "app_url" text not null,
    "tracked_link" text,
    "logo_url" text,
    "screenshot_url" text,
    "is_featured" boolean default false,
    "is_paid_placement" boolean default false,
    "is_active" boolean default true,
    "display_order" integer,
    "last_used_date" date,
    "times_used" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "tool_type" text default 'Client'::text,
    "category_priority" integer default 0,
    "is_affiliate" boolean default false,
    "clerk_user_id" text,
    "submitter_email" text,
    "submitter_name" text,
    "submitter_image_url" text,
    "submission_status" text default 'pending'::text,
    "rejection_reason" text,
    "approved_by" text,
    "approved_at" timestamp with time zone,
    "plan" text default 'free'::text,
    "stripe_payment_id" text,
    "stripe_subscription_id" text,
    "stripe_customer_id" text,
    "sponsor_start_date" timestamp with time zone,
    "sponsor_end_date" timestamp with time zone,
    "view_count" integer default 0,
    "click_count" integer default 0,
    "ai_app_module_id" uuid,
    "priority" integer default 0,
    "pinned_position" integer,
    "button_text" text,
    "logo_alt" character varying(200),
    "screenshot_alt" character varying(200)
      );



  create table "public"."ai_prompt_tests" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" text not null,
    "publication_id" text not null,
    "provider" text not null,
    "model" text not null,
    "prompt_type" text not null,
    "prompt" text not null,
    "parameters" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."ai_prompt_tests" enable row level security;


  create table "public"."app_settings" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "key" text not null,
    "description" text,
    "updated_by" text,
    "updated_at" timestamp with time zone default now(),
    "custom_default" text,
    "value" jsonb,
    "ai_provider" text default 'openai'::text,
    "expected_outputs" jsonb,
    "publication_id" uuid not null
      );



  create table "public"."archived_articles" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "original_article_id" uuid not null,
    "post_id" uuid,
    "issue_id" text,
    "headline" text not null,
    "content" text not null,
    "rank" integer,
    "is_active" boolean,
    "skipped" boolean,
    "fact_check_score" numeric,
    "fact_check_details" text,
    "word_count" integer,
    "review_position" integer,
    "final_position" integer,
    "archived_at" timestamp with time zone default now(),
    "archive_reason" text not null,
    "issue_date" date,
    "campaign_status" text,
    "original_created_at" timestamp with time zone,
    "original_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."archived_newsletters" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" text not null,
    "issue_date" date not null,
    "subject_line" text not null,
    "send_date" timestamp with time zone not null,
    "recipient_count" integer default 0,
    "html_backup" text,
    "metadata" jsonb default '{}'::jsonb,
    "articles" jsonb default '[]'::jsonb,
    "events" jsonb default '[]'::jsonb,
    "sections" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "publication_id" text not null,
    "secondary_articles" jsonb default '[]'::jsonb
      );



  create table "public"."archived_post_ratings" (
    "id" uuid not null default gen_random_uuid(),
    "archived_post_id" uuid,
    "interest_level" integer,
    "local_relevance" integer,
    "community_impact" integer,
    "ai_reasoning" text,
    "total_score" numeric,
    "criteria_1_score" integer,
    "criteria_1_reason" text,
    "criteria_1_weight" numeric,
    "criteria_2_score" integer,
    "criteria_2_reason" text,
    "criteria_2_weight" numeric,
    "criteria_3_score" integer,
    "criteria_3_reason" text,
    "criteria_3_weight" numeric,
    "criteria_4_score" integer,
    "criteria_4_reason" text,
    "criteria_4_weight" numeric,
    "criteria_5_score" integer,
    "criteria_5_reason" text,
    "criteria_5_weight" numeric,
    "archived_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );



  create table "public"."archived_rss_posts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "original_post_id" uuid not null,
    "feed_id" uuid,
    "issue_id" text,
    "external_id" text not null,
    "title" text not null,
    "description" text,
    "content" text,
    "author" text,
    "publication_date" timestamp with time zone,
    "source_url" text,
    "image_url" text,
    "processed_at" timestamp with time zone,
    "archived_at" timestamp with time zone default now(),
    "archive_reason" text not null,
    "campaign_date" date,
    "created_at" timestamp with time zone default now(),
    "criteria_1_score" integer,
    "criteria_1_reason" text,
    "criteria_2_score" integer,
    "criteria_2_reason" text,
    "criteria_3_score" integer,
    "criteria_3_reason" text,
    "criteria_4_score" integer,
    "criteria_4_reason" text,
    "criteria_5_score" integer,
    "criteria_5_reason" text,
    "final_priority_score" numeric(10,2),
    "criteria_enabled" integer
      );



  create table "public"."archived_secondary_articles" (
    "id" text not null default (gen_random_uuid())::text,
    "original_article_id" text not null,
    "post_id" uuid,
    "issue_id" text not null,
    "headline" text not null,
    "content" text not null,
    "rank" integer,
    "is_active" boolean,
    "skipped" boolean,
    "fact_check_score" numeric,
    "fact_check_details" text,
    "word_count" integer,
    "review_position" integer,
    "final_position" integer,
    "archived_at" timestamp with time zone default now(),
    "archive_reason" text not null,
    "campaign_date" date,
    "campaign_status" text,
    "original_created_at" timestamp with time zone,
    "original_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."article_categories" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid,
    "name" text not null,
    "slug" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."article_categories" enable row level security;


  create table "public"."article_module_criteria" (
    "id" uuid not null default gen_random_uuid(),
    "article_module_id" uuid not null,
    "criteria_number" integer not null,
    "name" text not null,
    "weight" numeric(5,4) default 0.2000,
    "ai_prompt" text,
    "ai_model" text default 'gpt-4o'::text,
    "ai_provider" text default 'openai'::text,
    "temperature" numeric(2,1) default 0.7,
    "max_tokens" integer default 500,
    "expected_output" text,
    "is_active" boolean default true,
    "display_order" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "enforce_minimum" boolean default false,
    "minimum_score" integer
      );


alter table "public"."article_module_criteria" enable row level security;


  create table "public"."article_module_prompts" (
    "id" uuid not null default gen_random_uuid(),
    "article_module_id" uuid not null,
    "prompt_type" text not null,
    "ai_prompt" text not null,
    "ai_model" text default 'gpt-4o'::text,
    "ai_provider" text default 'openai'::text,
    "temperature" numeric(2,1) default 0.7,
    "max_tokens" integer default 2000,
    "expected_output" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."article_module_prompts" enable row level security;


  create table "public"."article_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "selection_mode" text default 'top_score'::text,
    "block_order" jsonb default '["source_image", "title", "body"]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "articles_count" integer default 3,
    "lookback_hours" integer default 72,
    "ai_image_prompt" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."article_modules" enable row level security;


  create table "public"."articles" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "post_id" uuid,
    "issue_id" text,
    "headline" text not null,
    "content" text not null,
    "rank" integer,
    "is_active" boolean default false,
    "skipped" boolean default false,
    "fact_check_score" numeric,
    "fact_check_details" text,
    "word_count" integer,
    "review_position" integer,
    "final_position" integer,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "breaking_news_score" integer,
    "breaking_news_category" text,
    "ai_summary" text,
    "ai_title" text
      );



  create table "public"."contact_submissions" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "email" text not null,
    "message" text not null,
    "created_at" timestamp with time zone default now(),
    "publication_id" uuid not null,
    "status" text default 'new'::text
      );



  create table "public"."directory_categories" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid,
    "name" text not null,
    "description" text,
    "slug" text not null,
    "image_url" text,
    "status" text default 'approved'::text,
    "display_order" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."directory_categories" enable row level security;


  create table "public"."directory_categories_tools" (
    "category_id" uuid not null,
    "tool_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."directory_categories_tools" enable row level security;


  create table "public"."duplicate_groups" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" text not null,
    "primary_post_id" uuid not null,
    "topic_signature" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."duplicate_posts" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "post_id" uuid not null,
    "similarity_score" numeric default 0.8,
    "detection_method" character varying(50),
    "actual_similarity_score" numeric,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."email_metrics" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "issue_id" text,
    "mailerlite_issue_id" text,
    "sent_count" integer default 0,
    "delivered_count" integer default 0,
    "opened_count" integer default 0,
    "clicked_count" integer default 0,
    "bounced_count" integer default 0,
    "unsubscribed_count" integer default 0,
    "open_rate" numeric,
    "click_rate" numeric,
    "bounce_rate" numeric,
    "unsubscribe_rate" numeric,
    "imported_at" timestamp with time zone default now(),
    "sendgrid_singlesend_id" text
      );



  create table "public"."event_venues" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "address" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."events" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "newsletter_id" uuid,
    "external_id" text not null,
    "title" text not null,
    "description" text,
    "event_summary" text,
    "start_date" timestamp with time zone not null,
    "end_date" timestamp with time zone,
    "venue" text,
    "address" text,
    "url" text,
    "website" text,
    "image_url" text,
    "original_image_url" text,
    "cropped_image_url" text,
    "featured" boolean default false,
    "paid_placement" boolean default false,
    "active" boolean default true,
    "submission_status" text default 'approved'::text,
    "payment_status" text,
    "payment_intent_id" text,
    "payment_amount" numeric,
    "submitter_name" text,
    "submitter_email" text,
    "submitter_phone" text,
    "reviewed_by" text,
    "reviewed_at" timestamp with time zone,
    "raw_data" jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."excluded_ips" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid not null,
    "ip_address" text not null,
    "reason" text,
    "added_by" text,
    "created_at" timestamp with time zone default now(),
    "is_range" boolean default false,
    "cidr_prefix" smallint,
    "exclusion_source" text default 'manual'::text
      );



  create table "public"."feedback_blocks" (
    "id" uuid not null default gen_random_uuid(),
    "feedback_module_id" uuid not null,
    "block_type" text not null,
    "display_order" integer not null default 0,
    "is_enabled" boolean not null default true,
    "title_text" text,
    "static_content" text,
    "is_italic" boolean default false,
    "is_bold" boolean default false,
    "text_size" text default 'medium'::text,
    "label" text,
    "vote_options" jsonb,
    "team_photos" jsonb,
    "config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."feedback_blocks" enable row level security;


  create table "public"."feedback_comment_read_status" (
    "id" uuid not null default gen_random_uuid(),
    "comment_id" uuid not null,
    "user_id" uuid not null,
    "read_at" timestamp with time zone not null default now()
      );


alter table "public"."feedback_comment_read_status" enable row level security;


  create table "public"."feedback_comments" (
    "id" uuid not null default gen_random_uuid(),
    "feedback_vote_id" uuid not null,
    "publication_id" uuid not null,
    "issue_id" text,
    "subscriber_email" text not null,
    "comment_text" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."feedback_comments" enable row level security;


  create table "public"."feedback_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null default 'Feedback'::text,
    "display_order" integer default 999,
    "is_active" boolean default true,
    "block_order" jsonb default '["title", "body", "vote_options", "sign_off", "team_photos"]'::jsonb,
    "title_text" text default 'That''s it for today!'::text,
    "body_text" text,
    "body_is_italic" boolean default false,
    "sign_off_text" text default 'See you tomorrow!'::text,
    "sign_off_is_italic" boolean default true,
    "vote_options" jsonb default '[{"emoji": "star", "label": "Nailed it", "value": 5}, {"emoji": "star", "label": "Average", "value": 3}, {"emoji": "star", "label": "Fail", "value": 1}]'::jsonb,
    "team_photos" jsonb default '[]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "show_name" boolean default true
      );


alter table "public"."feedback_modules" enable row level security;


  create table "public"."feedback_responses" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_date" date not null,
    "issue_id" uuid,
    "publication_id" uuid,
    "subscriber_email" text not null,
    "section_choice" text not null,
    "mailerlite_updated" boolean default false,
    "ip_address" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."feedback_responses" enable row level security;


  create table "public"."feedback_votes" (
    "id" uuid not null default gen_random_uuid(),
    "feedback_module_id" uuid not null,
    "publication_id" uuid not null,
    "issue_id" text,
    "subscriber_email" text not null,
    "ip_address" text,
    "selected_value" integer not null,
    "selected_label" text not null,
    "voted_at" timestamp with time zone default now()
      );


alter table "public"."feedback_votes" enable row level security;


  create table "public"."issue_advertisements" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "issue_id" text,
    "advertisement_id" uuid,
    "issue_date" date not null,
    "used_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );



  create table "public"."issue_ai_app_modules" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" uuid not null,
    "ai_app_module_id" uuid not null,
    "app_ids" jsonb default '[]'::jsonb,
    "selection_mode" text,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone,
    "pinned_overrides" jsonb default '{}'::jsonb
      );


alter table "public"."issue_ai_app_modules" enable row level security;


  create table "public"."issue_ai_app_selections" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "issue_id" text not null,
    "app_id" uuid not null,
    "selection_order" integer not null,
    "is_featured" boolean default false,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."issue_article_modules" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" uuid not null,
    "article_module_id" uuid not null,
    "article_ids" jsonb default '[]'::jsonb,
    "selection_mode" text,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone
      );


alter table "public"."issue_article_modules" enable row level security;


  create table "public"."issue_breaking_news" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" text not null,
    "post_id" uuid not null,
    "section" text not null,
    "position" integer not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."issue_events" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "issue_id" text,
    "event_id" uuid,
    "event_date" date not null,
    "is_selected" boolean default true,
    "is_featured" boolean default false,
    "display_order" integer,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."issue_module_ads" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" uuid not null,
    "ad_module_id" uuid not null,
    "advertisement_id" uuid,
    "selection_mode" text,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone
      );



  create table "public"."issue_poll_modules" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" uuid not null,
    "poll_module_id" uuid not null,
    "poll_id" uuid,
    "poll_snapshot" jsonb,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone
      );


alter table "public"."issue_poll_modules" enable row level security;


  create table "public"."issue_prompt_modules" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" uuid not null,
    "prompt_module_id" uuid not null,
    "prompt_id" uuid,
    "selection_mode" text,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone
      );


alter table "public"."issue_prompt_modules" enable row level security;


  create table "public"."issue_prompt_selections" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "issue_id" text not null,
    "prompt_id" uuid not null,
    "selection_order" integer not null,
    "is_featured" boolean default false,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."issue_sparkloop_rec_modules" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" text not null,
    "sparkloop_rec_module_id" uuid not null,
    "ref_codes" jsonb default '[]'::jsonb,
    "selection_mode" text,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone
      );


alter table "public"."issue_sparkloop_rec_modules" enable row level security;


  create table "public"."issue_text_box_blocks" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" text not null,
    "text_box_block_id" uuid not null,
    "generated_content" text,
    "generated_image_url" text,
    "override_content" text,
    "override_image_url" text,
    "generation_status" text default 'pending'::text,
    "generation_error" text,
    "generated_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "image_alt" character varying(200)
      );


alter table "public"."issue_text_box_blocks" enable row level security;


  create table "public"."issue_text_box_modules" (
    "id" uuid not null default gen_random_uuid(),
    "issue_id" text not null,
    "text_box_module_id" uuid not null,
    "selected_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."issue_text_box_modules" enable row level security;


  create table "public"."link_clicks" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "issue_date" date not null,
    "issue_id" text,
    "subscriber_email" text not null,
    "subscriber_id" text,
    "link_url" text not null,
    "link_section" text not null,
    "clicked_at" timestamp with time zone default now(),
    "user_agent" text,
    "ip_address" text,
    "created_at" timestamp with time zone default now(),
    "publication_id" uuid,
    "is_bot_ua" boolean default false,
    "bot_ua_reason" text
      );



  create table "public"."mailerlite_field_updates" (
    "id" uuid not null default gen_random_uuid(),
    "subscriber_email" text not null,
    "field_name" text not null,
    "field_value" boolean default true,
    "status" text default 'pending'::text,
    "error_message" text,
    "retry_count" integer default 0,
    "created_at" timestamp with time zone default now(),
    "processed_at" timestamp with time zone,
    "publication_id" uuid not null,
    "issue_id" uuid,
    "link_click_id" uuid
      );



  create table "public"."manual_articles" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid,
    "title" text not null,
    "slug" text not null,
    "body" text not null,
    "image_url" text,
    "section_type" text not null,
    "category_id" uuid,
    "publish_date" date not null default CURRENT_DATE,
    "status" text default 'draft'::text,
    "used_in_issue_id" text,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."manual_articles" enable row level security;


  create table "public"."module_articles" (
    "id" uuid not null default gen_random_uuid(),
    "post_id" uuid,
    "issue_id" text not null,
    "article_module_id" uuid not null,
    "headline" text,
    "content" text,
    "rank" integer,
    "is_active" boolean default false,
    "skipped" boolean default false,
    "fact_check_score" numeric(3,1),
    "fact_check_details" text,
    "word_count" integer,
    "review_position" integer,
    "final_position" integer,
    "breaking_news_score" numeric(3,1),
    "breaking_news_category" text,
    "ai_summary" text,
    "ai_title" text,
    "ai_image_url" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "image_alt" character varying(200)
      );


alter table "public"."module_articles" enable row level security;


  create table "public"."newsletter_sections" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid,
    "name" text not null,
    "display_order" integer not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "section_type" public.section_type default 'custom'::public.section_type
      );



  create table "public"."pending_event_submissions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "stripe_session_id" text not null,
    "events_data" jsonb not null,
    "submitter_email" text not null,
    "submitter_name" text not null,
    "total_amount" numeric not null,
    "created_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone not null,
    "processed" boolean default false,
    "processed_at" timestamp with time zone
      );



  create table "public"."poll_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "block_order" jsonb default '["title", "question", "image", "options"]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."poll_modules" enable row level security;


  create table "public"."poll_responses" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "poll_id" uuid not null,
    "publication_id" uuid not null,
    "issue_id" text,
    "subscriber_email" text not null,
    "selected_option" text not null,
    "responded_at" timestamp with time zone default now(),
    "ip_address" text
      );



  create table "public"."polls" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid not null,
    "title" text not null,
    "question" text not null,
    "options" text[] not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "image_url" text,
    "image_alt" character varying(200)
      );



  create table "public"."post_ratings" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "post_id" uuid,
    "interest_level" integer not null,
    "local_relevance" integer not null,
    "community_impact" integer not null,
    "total_score" numeric not null,
    "ai_reasoning" text,
    "created_at" timestamp with time zone default now(),
    "criteria_1_score" integer,
    "criteria_1_reason" text,
    "criteria_1_weight" numeric(10,2),
    "criteria_2_score" integer,
    "criteria_2_reason" text,
    "criteria_2_weight" numeric(10,2),
    "criteria_3_score" integer,
    "criteria_3_reason" text,
    "criteria_3_weight" numeric(10,2),
    "criteria_4_score" integer,
    "criteria_4_reason" text,
    "criteria_4_weight" numeric(10,2),
    "criteria_5_score" integer,
    "criteria_5_reason" text,
    "criteria_5_weight" numeric(10,2)
      );



  create table "public"."prompt_ideas" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid not null,
    "title" text not null,
    "prompt_text" text not null,
    "category" text,
    "use_case" text,
    "suggested_model" text,
    "difficulty_level" text,
    "estimated_time" text,
    "is_featured" boolean default false,
    "is_active" boolean default true,
    "display_order" integer,
    "last_used_date" date,
    "times_used" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "prompt_module_id" uuid,
    "priority" integer default 0
      );



  create table "public"."prompt_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "selection_mode" text default 'random'::text,
    "block_order" jsonb default '["title", "body"]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "next_position" integer default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."prompt_modules" enable row level security;


  create table "public"."publication_issues" (
    "id" text not null default gen_random_uuid(),
    "publication_id" uuid,
    "date" date not null,
    "status" text not null default 'draft'::text,
    "subject_line" text,
    "review_sent_at" timestamp with time zone,
    "final_sent_at" timestamp with time zone,
    "last_action" text,
    "last_action_at" timestamp with time zone,
    "last_action_by" text,
    "status_before_send" text,
    "metrics" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "workflow_state" text default 'pending_archive'::text,
    "workflow_state_started_at" timestamp with time zone,
    "workflow_error" text,
    "welcome_intro" text,
    "welcome_tagline" text,
    "welcome_summary" text,
    "failure_alerted_at" timestamp without time zone,
    "poll_id" uuid,
    "poll_snapshot" jsonb,
    "secondary_sent_at" timestamp with time zone
      );



  create table "public"."publication_settings" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid not null,
    "key" text not null,
    "value" text,
    "custom_default" text,
    "description" text,
    "updated_by" text,
    "updated_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );



  create table "public"."publications" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "slug" text not null,
    "name" text not null,
    "subdomain" text not null,
    "description" text,
    "logo_url" text,
    "primary_color" text default '#3B82F6'::text,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "website_domain" text
      );



  create table "public"."rss_feeds" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid,
    "url" text not null,
    "name" text not null,
    "active" boolean default true,
    "last_processed" timestamp with time zone,
    "processing_errors" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "description" text,
    "last_error" text,
    "use_for_primary_section" boolean default true,
    "use_for_secondary_section" boolean default false,
    "article_module_id" uuid
      );



  create table "public"."rss_posts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "feed_id" uuid,
    "issue_id" text,
    "external_id" text not null,
    "title" text not null,
    "description" text,
    "content" text,
    "author" text,
    "publication_date" timestamp with time zone,
    "source_url" text,
    "image_url" text,
    "processed_at" timestamp with time zone default now(),
    "ai_summary" text,
    "ai_title" text,
    "criteria_1_score" integer,
    "criteria_1_reason" text,
    "criteria_2_score" integer,
    "criteria_2_reason" text,
    "criteria_3_score" integer,
    "criteria_3_reason" text,
    "criteria_4_score" integer,
    "criteria_4_reason" text,
    "criteria_5_score" integer,
    "criteria_5_reason" text,
    "final_priority_score" numeric(10,2),
    "criteria_enabled" integer default 3,
    "full_article_text" text,
    "extraction_status" text default 'pending'::text,
    "extraction_error" text,
    "article_module_id" uuid,
    "image_alt" character varying(200)
      );



  create table "public"."secondary_articles" (
    "id" text not null default (gen_random_uuid())::text,
    "post_id" uuid not null,
    "issue_id" text not null,
    "headline" text not null,
    "content" text not null,
    "rank" integer,
    "is_active" boolean default false,
    "skipped" boolean default false,
    "fact_check_score" numeric,
    "fact_check_details" text,
    "word_count" integer,
    "review_position" integer,
    "final_position" integer,
    "breaking_news_score" numeric,
    "breaking_news_category" text,
    "ai_summary" text,
    "ai_title" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."sendgrid_field_updates" (
    "id" uuid not null default gen_random_uuid(),
    "subscriber_email" text not null,
    "field_name" text not null,
    "field_value" text,
    "status" text default 'pending'::text,
    "retry_count" integer default 0,
    "error_message" text,
    "publication_id" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "issue_id" uuid,
    "link_click_id" uuid
      );



  create table "public"."sparkloop_daily_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "ref_code" text not null,
    "snapshot_date" date not null,
    "sparkloop_confirmed" integer not null default 0,
    "sparkloop_rejected" integer not null default 0,
    "sparkloop_pending" integer not null default 0,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."sparkloop_events" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid,
    "event_type" text not null,
    "event_id" text,
    "subscriber_email" text not null,
    "subscriber_uuid" text,
    "referred_publication" text,
    "referred_publication_id" text,
    "referrer_email" text,
    "referrer_uuid" text,
    "reward_name" text,
    "reward_id" text,
    "raw_payload" jsonb,
    "event_timestamp" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."sparkloop_events" enable row level security;


  create table "public"."sparkloop_module_clicks" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "subscriber_email" text not null,
    "ref_code" text not null,
    "issue_id" text,
    "ip_address" text,
    "user_agent" text,
    "country_code" text,
    "is_bot_ua" boolean default false,
    "bot_ua_reason" text,
    "is_ip_excluded" boolean default false,
    "sparkloop_called" boolean default false,
    "sparkloop_success" boolean,
    "clicked_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );


alter table "public"."sparkloop_module_clicks" enable row level security;


  create table "public"."sparkloop_offer_events" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "offer_recommendation_id" text not null,
    "event_type" text not null,
    "subscriber_email" text,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."sparkloop_rec_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null default 'Recommended Newsletters'::text,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "selection_mode" text not null default 'score_based'::text,
    "block_order" jsonb default '["logo", "name", "description", "button"]'::jsonb,
    "config" jsonb default '{}'::jsonb,
    "recs_count" integer default 3,
    "next_position" integer default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."sparkloop_rec_modules" enable row level security;


  create table "public"."sparkloop_recommendations" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid,
    "ref_code" text not null,
    "sparkloop_uuid" text,
    "publication_name" text not null,
    "publication_logo" text,
    "description" text,
    "status" text default 'active'::text,
    "cpa" integer,
    "screening_period" integer,
    "sparkloop_rcr" numeric(5,2),
    "impressions" integer default 0,
    "selections" integer default 0,
    "submissions" integer default 0,
    "confirms" integer default 0,
    "rejections" integer default 0,
    "pending" integer default 0,
    "our_rcr" numeric(5,2),
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "type" text default 'paid'::text,
    "pinned" boolean default false,
    "position" integer,
    "max_payout" integer,
    "partner_program_uuid" text,
    "sparkloop_pending" integer default 0,
    "sparkloop_rejected" integer default 0,
    "sparkloop_confirmed" integer default 0,
    "sparkloop_earnings" integer default 0,
    "sparkloop_net_earnings" integer default 0,
    "our_cr" numeric(5,2),
    "excluded" boolean default false,
    "excluded_reason" text,
    "remaining_budget_dollars" numeric,
    "our_total_subscribes" integer default 0,
    "our_confirms" integer default 0,
    "our_rejections" integer default 0,
    "our_pending" integer default 0,
    "last_seen_in_generate" timestamp with time zone,
    "paused_reason" text,
    "override_cr" numeric(5,2) default NULL::numeric,
    "override_rcr" numeric(5,2) default NULL::numeric,
    "page_impressions" integer default 0,
    "page_submissions" integer default 0,
    "page_cr" numeric(5,2),
    "eligible_for_module" boolean default false
      );


alter table "public"."sparkloop_recommendations" enable row level security;


  create table "public"."sparkloop_referrals" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "subscriber_email" text not null,
    "ref_code" text not null,
    "source" text not null default 'custom_popup'::text,
    "status" text not null default 'subscribed'::text,
    "subscribed_at" timestamp with time zone,
    "pending_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "fb_conversion_sent_at" timestamp with time zone
      );


alter table "public"."sparkloop_referrals" enable row level security;


  create table "public"."subscriber_real_click_status" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "subscriber_email" text not null,
    "has_real_click" boolean not null default false,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."subscriber_real_click_status" enable row level security;


  create table "public"."system_logs" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "level" text not null,
    "message" text not null,
    "context" jsonb default '{}'::jsonb,
    "source" text,
    "timestamp" timestamp with time zone default now()
      );



  create table "public"."text_box_blocks" (
    "id" uuid not null default gen_random_uuid(),
    "text_box_module_id" uuid not null,
    "block_type" text not null,
    "display_order" integer default 0,
    "static_content" text,
    "text_size" text default 'medium'::text,
    "ai_prompt_json" jsonb,
    "generation_timing" text default 'after_articles'::text,
    "image_type" text,
    "static_image_url" text,
    "ai_image_prompt" text,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "is_bold" boolean default false,
    "is_italic" boolean default false,
    "image_alt" character varying(200)
      );


alter table "public"."text_box_blocks" enable row level security;


  create table "public"."text_box_modules" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid not null,
    "name" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "show_name" boolean default true,
    "config" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."text_box_modules" enable row level security;


  create table "public"."tool_directory_clicks" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "publication_id" uuid not null,
    "click_type" text not null,
    "tool_id" uuid,
    "tool_name" text,
    "category_slug" text,
    "category_name" text,
    "destination_url" text,
    "referrer_page" text,
    "referrer_type" text,
    "user_agent" text,
    "ip_address" text,
    "clicked_at" timestamp with time zone default now()
      );



  create table "public"."tools_directory" (
    "id" uuid not null default gen_random_uuid(),
    "publication_id" uuid,
    "tool_name" text not null,
    "tagline" text,
    "description" text not null,
    "website_url" text not null,
    "logo_url" text,
    "screenshot_url" text,
    "tool_image_url" text,
    "clerk_user_id" text,
    "submitter_email" text,
    "submitter_name" text,
    "submitter_image_url" text,
    "status" text default 'pending'::text,
    "rejection_reason" text,
    "approved_by" text,
    "approved_at" timestamp with time zone,
    "is_sponsored" boolean default false,
    "plan" text default 'free'::text,
    "stripe_payment_id" text,
    "sponsor_start_date" timestamp with time zone,
    "sponsor_end_date" timestamp with time zone,
    "is_featured" boolean default false,
    "display_order" integer,
    "view_count" integer default 0,
    "click_count" integer default 0,
    "legacy_ai_app_id" uuid,
    "is_affiliate" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "logo_image_url" text,
    "stripe_subscription_id" text,
    "stripe_customer_id" text
      );


alter table "public"."tools_directory" enable row level security;


  create table "public"."user_activities" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" text,
    "issue_id" text,
    "action" text not null,
    "details" jsonb default '{}'::jsonb,
    "timestamp" timestamp with time zone default now()
      );



  create table "public"."users" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "email" text not null,
    "name" text,
    "role" text not null default 'admin'::text,
    "last_login" timestamp with time zone,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


CREATE UNIQUE INDEX ad_block_types_name_key ON public.ad_block_types USING btree (name);

CREATE UNIQUE INDEX ad_block_types_pkey ON public.ad_block_types USING btree (id);

CREATE UNIQUE INDEX ad_module_advertisers_ad_module_id_advertiser_id_key ON public.ad_module_advertisers USING btree (ad_module_id, advertiser_id);

CREATE UNIQUE INDEX ad_module_advertisers_pkey ON public.ad_module_advertisers USING btree (id);

CREATE UNIQUE INDEX ad_modules_pkey ON public.ad_modules USING btree (id);

CREATE UNIQUE INDEX ad_pricing_tiers_pkey ON public.ad_pricing_tiers USING btree (id);

CREATE UNIQUE INDEX advertisements_pkey ON public.advertisements USING btree (id);

CREATE UNIQUE INDEX advertisers_pkey ON public.advertisers USING btree (id);

CREATE UNIQUE INDEX ai_app_block_types_name_key ON public.ai_app_block_types USING btree (name);

CREATE UNIQUE INDEX ai_app_block_types_pkey ON public.ai_app_block_types USING btree (id);

CREATE UNIQUE INDEX ai_app_modules_pkey ON public.ai_app_modules USING btree (id);

CREATE UNIQUE INDEX ai_applications_pkey ON public.ai_applications USING btree (id);

CREATE UNIQUE INDEX ai_prompt_tests_pkey ON public.ai_prompt_tests USING btree (id);

CREATE UNIQUE INDEX ai_prompt_tests_user_id_newsletter_id_provider_model_prompt_key ON public.ai_prompt_tests USING btree (user_id, publication_id, provider, model, prompt_type);

CREATE UNIQUE INDEX ai_prompt_tests_user_id_publication_id_provider_model_prompt_t_ ON public.ai_prompt_tests USING btree (user_id, publication_id, provider, model, prompt_type);

CREATE UNIQUE INDEX app_settings_newsletter_key ON public.app_settings USING btree (publication_id, key);

CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (id);

CREATE UNIQUE INDEX archived_articles_pkey ON public.archived_articles USING btree (id);

CREATE UNIQUE INDEX archived_newsletters_issue_id_key ON public.archived_newsletters USING btree (issue_id);

CREATE UNIQUE INDEX archived_newsletters_pkey ON public.archived_newsletters USING btree (id);

CREATE UNIQUE INDEX archived_newsletters_publication_id_issue_date_key ON public.archived_newsletters USING btree (publication_id, issue_date);

CREATE UNIQUE INDEX archived_post_ratings_pkey ON public.archived_post_ratings USING btree (id);

CREATE UNIQUE INDEX archived_rss_posts_pkey ON public.archived_rss_posts USING btree (id);

CREATE UNIQUE INDEX archived_secondary_articles_pkey ON public.archived_secondary_articles USING btree (id);

CREATE UNIQUE INDEX article_categories_pkey ON public.article_categories USING btree (id);

CREATE UNIQUE INDEX article_categories_publication_id_slug_key ON public.article_categories USING btree (publication_id, slug);

CREATE UNIQUE INDEX article_module_criteria_article_module_id_criteria_number_key ON public.article_module_criteria USING btree (article_module_id, criteria_number);

CREATE UNIQUE INDEX article_module_criteria_pkey ON public.article_module_criteria USING btree (id);

CREATE UNIQUE INDEX article_module_prompts_article_module_id_prompt_type_key ON public.article_module_prompts USING btree (article_module_id, prompt_type);

CREATE UNIQUE INDEX article_module_prompts_pkey ON public.article_module_prompts USING btree (id);

CREATE UNIQUE INDEX article_modules_pkey ON public.article_modules USING btree (id);

CREATE UNIQUE INDEX articles_pkey ON public.articles USING btree (id);

CREATE UNIQUE INDEX contact_submissions_pkey ON public.contact_submissions USING btree (id);

CREATE UNIQUE INDEX directory_categories_pkey ON public.directory_categories USING btree (id);

CREATE UNIQUE INDEX directory_categories_publication_id_slug_key ON public.directory_categories USING btree (publication_id, slug);

CREATE UNIQUE INDEX directory_categories_tools_pkey ON public.directory_categories_tools USING btree (category_id, tool_id);

CREATE UNIQUE INDEX duplicate_groups_pkey ON public.duplicate_groups USING btree (id);

CREATE UNIQUE INDEX duplicate_posts_pkey ON public.duplicate_posts USING btree (id);

CREATE UNIQUE INDEX email_metrics_pkey ON public.email_metrics USING btree (id);

CREATE UNIQUE INDEX event_venues_name_key ON public.event_venues USING btree (name);

CREATE UNIQUE INDEX event_venues_pkey ON public.event_venues USING btree (id);

CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);

CREATE UNIQUE INDEX feedback_blocks_pkey ON public.feedback_blocks USING btree (id);

CREATE UNIQUE INDEX feedback_comment_read_status_comment_id_user_id_key ON public.feedback_comment_read_status USING btree (comment_id, user_id);

CREATE UNIQUE INDEX feedback_comment_read_status_pkey ON public.feedback_comment_read_status USING btree (id);

CREATE UNIQUE INDEX feedback_comments_pkey ON public.feedback_comments USING btree (id);

CREATE UNIQUE INDEX feedback_modules_pkey ON public.feedback_modules USING btree (id);

CREATE UNIQUE INDEX feedback_modules_publication_id_key ON public.feedback_modules USING btree (publication_id);

CREATE UNIQUE INDEX feedback_responses_pkey ON public.feedback_responses USING btree (id);

CREATE UNIQUE INDEX feedback_votes_feedback_module_id_subscriber_email_issue_id_key ON public.feedback_votes USING btree (feedback_module_id, subscriber_email, issue_id);

CREATE UNIQUE INDEX feedback_votes_pkey ON public.feedback_votes USING btree (id);

CREATE INDEX idx_ad_module_advertisers_advertiser ON public.ad_module_advertisers USING btree (advertiser_id);

CREATE INDEX idx_ad_module_advertisers_module ON public.ad_module_advertisers USING btree (ad_module_id);

CREATE INDEX idx_ad_module_advertisers_module_order ON public.ad_module_advertisers USING btree (ad_module_id, display_order);

CREATE INDEX idx_ad_modules_active ON public.ad_modules USING btree (publication_id, is_active);

CREATE INDEX idx_ad_modules_display_order ON public.ad_modules USING btree (publication_id, display_order);

CREATE INDEX idx_ad_modules_publication_id ON public.ad_modules USING btree (publication_id);

CREATE INDEX idx_advertisements_ad_module_id ON public.advertisements USING btree (ad_module_id);

CREATE INDEX idx_advertisements_ad_type ON public.advertisements USING btree (ad_type);

CREATE INDEX idx_advertisements_advertiser_id ON public.advertisements USING btree (advertiser_id);

CREATE INDEX idx_advertisements_clerk_user_id ON public.advertisements USING btree (clerk_user_id);

CREATE INDEX idx_advertisements_module_status ON public.advertisements USING btree (ad_module_id, status);

CREATE INDEX idx_advertisements_publication ON public.advertisements USING btree (publication_id);

CREATE INDEX idx_advertisements_status ON public.advertisements USING btree (status);

CREATE INDEX idx_advertisers_is_active ON public.advertisers USING btree (publication_id, is_active);

CREATE INDEX idx_advertisers_publication_id ON public.advertisers USING btree (publication_id);

CREATE INDEX idx_ai_app_modules_active ON public.ai_app_modules USING btree (publication_id, is_active);

CREATE INDEX idx_ai_app_modules_display_order ON public.ai_app_modules USING btree (publication_id, display_order);

CREATE INDEX idx_ai_app_modules_publication ON public.ai_app_modules USING btree (publication_id);

CREATE INDEX idx_ai_applications_clerk_user_id ON public.ai_applications USING btree (clerk_user_id);

CREATE INDEX idx_ai_applications_module_active ON public.ai_applications USING btree (ai_app_module_id, is_active);

CREATE INDEX idx_ai_applications_module_id ON public.ai_applications USING btree (ai_app_module_id);

CREATE INDEX idx_ai_applications_pinned_position ON public.ai_applications USING btree (publication_id, pinned_position) WHERE (pinned_position IS NOT NULL);

CREATE INDEX idx_ai_applications_priority ON public.ai_applications USING btree (priority DESC);

CREATE INDEX idx_ai_applications_submission_status ON public.ai_applications USING btree (submission_status);

CREATE INDEX idx_ai_applications_submitter_email ON public.ai_applications USING btree (submitter_email);

CREATE INDEX idx_ai_apps_active ON public.ai_applications USING btree (is_active);

CREATE INDEX idx_ai_apps_category ON public.ai_applications USING btree (category);

CREATE INDEX idx_ai_apps_category_priority ON public.ai_applications USING btree (category_priority DESC);

CREATE INDEX idx_ai_apps_is_affiliate ON public.ai_applications USING btree (is_affiliate);

CREATE INDEX idx_ai_apps_newsletter ON public.ai_applications USING btree (publication_id);

CREATE INDEX idx_ai_prompt_tests_user_publication ON public.ai_prompt_tests USING btree (user_id, publication_id);

CREATE INDEX idx_app_settings_key ON public.app_settings USING btree (key);

CREATE INDEX idx_app_settings_key_newsletter_id ON public.app_settings USING btree (key, publication_id);

CREATE INDEX idx_app_settings_newsletter_id ON public.app_settings USING btree (publication_id);

CREATE INDEX idx_archived_articles_issue ON public.archived_articles USING btree (issue_id);

CREATE INDEX idx_archived_articles_issue_date ON public.archived_articles USING btree (issue_date);

CREATE INDEX idx_archived_newsletters_issue_date ON public.archived_newsletters USING btree (issue_date DESC);

CREATE INDEX idx_archived_newsletters_publication_id ON public.archived_newsletters USING btree (publication_id);

CREATE INDEX idx_archived_newsletters_send_date ON public.archived_newsletters USING btree (send_date DESC);

CREATE INDEX idx_archived_post_ratings_post_id ON public.archived_post_ratings USING btree (archived_post_id);

CREATE INDEX idx_archived_rss_posts_issue ON public.archived_rss_posts USING btree (issue_id);

CREATE INDEX idx_archived_secondary_articles_issue ON public.archived_secondary_articles USING btree (issue_id);

CREATE INDEX idx_article_categories_publication_id ON public.article_categories USING btree (publication_id);

CREATE INDEX idx_article_module_criteria_active ON public.article_module_criteria USING btree (article_module_id, is_active);

CREATE INDEX idx_article_module_criteria_module ON public.article_module_criteria USING btree (article_module_id);

CREATE INDEX idx_article_module_prompts_module ON public.article_module_prompts USING btree (article_module_id);

CREATE INDEX idx_article_module_prompts_type ON public.article_module_prompts USING btree (article_module_id, prompt_type);

CREATE INDEX idx_article_modules_active ON public.article_modules USING btree (publication_id, is_active);

CREATE INDEX idx_article_modules_display_order ON public.article_modules USING btree (publication_id, display_order);

CREATE INDEX idx_article_modules_publication ON public.article_modules USING btree (publication_id);

CREATE INDEX idx_articles_active ON public.articles USING btree (is_active);

CREATE INDEX idx_articles_breaking_category ON public.articles USING btree (breaking_news_category);

CREATE INDEX idx_articles_breaking_score ON public.articles USING btree (breaking_news_score DESC);

CREATE INDEX idx_articles_issue ON public.articles USING btree (issue_id);

CREATE INDEX idx_articles_post ON public.articles USING btree (post_id);

CREATE INDEX idx_articles_rank ON public.articles USING btree (rank);

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions USING btree (created_at DESC);

CREATE INDEX idx_contact_submissions_publication_id ON public.contact_submissions USING btree (publication_id);

CREATE INDEX idx_contact_submissions_status ON public.contact_submissions USING btree (status);

CREATE INDEX idx_directory_categories_publication ON public.directory_categories USING btree (publication_id);

CREATE INDEX idx_directory_categories_slug ON public.directory_categories USING btree (slug);

CREATE INDEX idx_duplicate_groups_issue_id ON public.duplicate_groups USING btree (issue_id);

CREATE INDEX idx_duplicate_groups_primary_post_id ON public.duplicate_groups USING btree (primary_post_id);

CREATE INDEX idx_duplicate_posts_group_id ON public.duplicate_posts USING btree (group_id);

CREATE INDEX idx_duplicate_posts_post_id ON public.duplicate_posts USING btree (post_id);

CREATE INDEX idx_email_metrics_issue ON public.email_metrics USING btree (issue_id);

CREATE INDEX idx_email_metrics_sendgrid_id ON public.email_metrics USING btree (sendgrid_singlesend_id);

CREATE INDEX idx_events_active ON public.events USING btree (active);

CREATE INDEX idx_events_newsletter ON public.events USING btree (newsletter_id);

CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);

CREATE INDEX idx_excluded_ips_lookup ON public.excluded_ips USING btree (publication_id, ip_address);

CREATE INDEX idx_excluded_ips_publication ON public.excluded_ips USING btree (publication_id);

CREATE INDEX idx_feedback_blocks_module ON public.feedback_blocks USING btree (feedback_module_id);

CREATE INDEX idx_feedback_blocks_order ON public.feedback_blocks USING btree (feedback_module_id, display_order);

CREATE INDEX idx_feedback_blocks_type ON public.feedback_blocks USING btree (block_type);

CREATE INDEX idx_feedback_comment_read_status_comment ON public.feedback_comment_read_status USING btree (comment_id);

CREATE INDEX idx_feedback_comment_read_status_user ON public.feedback_comment_read_status USING btree (user_id);

CREATE INDEX idx_feedback_comments_created_at ON public.feedback_comments USING btree (created_at);

CREATE INDEX idx_feedback_comments_issue ON public.feedback_comments USING btree (issue_id);

CREATE INDEX idx_feedback_comments_publication ON public.feedback_comments USING btree (publication_id);

CREATE INDEX idx_feedback_comments_vote ON public.feedback_comments USING btree (feedback_vote_id);

CREATE INDEX idx_feedback_modules_active ON public.feedback_modules USING btree (publication_id, is_active);

CREATE INDEX idx_feedback_modules_publication ON public.feedback_modules USING btree (publication_id);

CREATE INDEX idx_feedback_responses_date ON public.feedback_responses USING btree (campaign_date);

CREATE INDEX idx_feedback_responses_email ON public.feedback_responses USING btree (subscriber_email);

CREATE INDEX idx_feedback_responses_publication ON public.feedback_responses USING btree (publication_id);

CREATE INDEX idx_feedback_votes_email ON public.feedback_votes USING btree (subscriber_email);

CREATE INDEX idx_feedback_votes_issue ON public.feedback_votes USING btree (issue_id);

CREATE INDEX idx_feedback_votes_module ON public.feedback_votes USING btree (feedback_module_id);

CREATE INDEX idx_feedback_votes_publication ON public.feedback_votes USING btree (publication_id);

CREATE INDEX idx_feedback_votes_voted_at ON public.feedback_votes USING btree (voted_at);

CREATE INDEX idx_issue_ads_issue ON public.issue_advertisements USING btree (issue_id);

CREATE INDEX idx_issue_ai_app_modules_issue ON public.issue_ai_app_modules USING btree (issue_id);

CREATE INDEX idx_issue_ai_app_modules_module ON public.issue_ai_app_modules USING btree (ai_app_module_id);

CREATE INDEX idx_issue_apps_issue ON public.issue_ai_app_selections USING btree (issue_id);

CREATE INDEX idx_issue_article_modules_issue ON public.issue_article_modules USING btree (issue_id);

CREATE INDEX idx_issue_article_modules_module ON public.issue_article_modules USING btree (article_module_id);

CREATE INDEX idx_issue_breaking_news_issue ON public.issue_breaking_news USING btree (issue_id);

CREATE INDEX idx_issue_breaking_news_section ON public.issue_breaking_news USING btree (section);

CREATE INDEX idx_issue_events_event ON public.issue_events USING btree (event_id);

CREATE INDEX idx_issue_events_issue ON public.issue_events USING btree (issue_id);

CREATE INDEX idx_issue_module_ads_ad_module_id ON public.issue_module_ads USING btree (ad_module_id);

CREATE INDEX idx_issue_module_ads_issue_id ON public.issue_module_ads USING btree (issue_id);

CREATE INDEX idx_issue_poll_modules_issue ON public.issue_poll_modules USING btree (issue_id);

CREATE INDEX idx_issue_poll_modules_module ON public.issue_poll_modules USING btree (poll_module_id);

CREATE INDEX idx_issue_poll_modules_poll ON public.issue_poll_modules USING btree (poll_id);

CREATE INDEX idx_issue_prompt_modules_issue ON public.issue_prompt_modules USING btree (issue_id);

CREATE INDEX idx_issue_prompt_modules_module ON public.issue_prompt_modules USING btree (prompt_module_id);

CREATE INDEX idx_issue_prompt_modules_prompt ON public.issue_prompt_modules USING btree (prompt_id);

CREATE INDEX idx_issue_prompts_issue ON public.issue_prompt_selections USING btree (issue_id);

CREATE INDEX idx_issue_sl_rec_modules_issue ON public.issue_sparkloop_rec_modules USING btree (issue_id);

CREATE INDEX idx_issue_sl_rec_modules_module ON public.issue_sparkloop_rec_modules USING btree (sparkloop_rec_module_id);

CREATE INDEX idx_issue_text_box_blocks_block ON public.issue_text_box_blocks USING btree (text_box_block_id);

CREATE INDEX idx_issue_text_box_blocks_issue ON public.issue_text_box_blocks USING btree (issue_id);

CREATE INDEX idx_issue_text_box_blocks_status ON public.issue_text_box_blocks USING btree (generation_status);

CREATE INDEX idx_issue_text_box_modules_issue ON public.issue_text_box_modules USING btree (issue_id);

CREATE INDEX idx_issue_text_box_modules_module ON public.issue_text_box_modules USING btree (text_box_module_id);

CREATE INDEX idx_issues_date ON public.publication_issues USING btree (date);

CREATE INDEX idx_issues_failed_unalerted ON public.publication_issues USING btree (status, failure_alerted_at) WHERE ((status = 'failed'::text) AND (failure_alerted_at IS NULL));

CREATE INDEX idx_issues_publication ON public.publication_issues USING btree (publication_id);

CREATE INDEX idx_issues_status ON public.publication_issues USING btree (status);

CREATE INDEX idx_issues_workflow_state ON public.publication_issues USING btree (workflow_state) WHERE (workflow_state <> ALL (ARRAY['complete'::text, 'failed'::text]));

CREATE INDEX idx_link_clicks_bot_ua ON public.link_clicks USING btree (is_bot_ua) WHERE (is_bot_ua = true);

CREATE INDEX idx_link_clicks_honeypot ON public.link_clicks USING btree (link_section, ip_address) WHERE (link_section = 'Honeypot'::text);

CREATE INDEX idx_link_clicks_issue ON public.link_clicks USING btree (issue_id);

CREATE INDEX idx_link_clicks_issue_date ON public.link_clicks USING btree (issue_date);

CREATE INDEX idx_link_clicks_publication ON public.link_clicks USING btree (publication_id);

CREATE INDEX idx_link_clicks_publication_ip ON public.link_clicks USING btree (publication_id, ip_address) WHERE (ip_address IS NOT NULL);

CREATE INDEX idx_link_clicks_velocity ON public.link_clicks USING btree (ip_address, issue_id, clicked_at DESC) WHERE (ip_address IS NOT NULL);

CREATE INDEX idx_mailerlite_updates_pending ON public.mailerlite_field_updates USING btree (status, created_at) WHERE (status = 'pending'::text);

CREATE INDEX idx_mailerlite_updates_publication ON public.mailerlite_field_updates USING btree (publication_id);

CREATE INDEX idx_mailerlite_updates_subscriber_field ON public.mailerlite_field_updates USING btree (subscriber_email, field_name);

CREATE INDEX idx_manual_articles_publication_id ON public.manual_articles USING btree (publication_id);

CREATE INDEX idx_manual_articles_publish_date ON public.manual_articles USING btree (publish_date);

CREATE INDEX idx_manual_articles_section_type ON public.manual_articles USING btree (section_type);

CREATE INDEX idx_manual_articles_status ON public.manual_articles USING btree (status);

CREATE INDEX idx_module_articles_active ON public.module_articles USING btree (issue_id, article_module_id, is_active);

CREATE INDEX idx_module_articles_issue ON public.module_articles USING btree (issue_id);

CREATE INDEX idx_module_articles_issue_module ON public.module_articles USING btree (issue_id, article_module_id);

CREATE INDEX idx_module_articles_module ON public.module_articles USING btree (article_module_id);

CREATE INDEX idx_module_articles_post ON public.module_articles USING btree (post_id);

CREATE INDEX idx_newsletter_sections_order ON public.newsletter_sections USING btree (display_order);

CREATE INDEX idx_newsletter_sections_publication ON public.newsletter_sections USING btree (publication_id);

CREATE INDEX idx_newsletter_sections_type ON public.newsletter_sections USING btree (publication_id, section_type);

CREATE INDEX idx_newsletter_settings_key ON public.publication_settings USING btree (key);

CREATE INDEX idx_newsletter_settings_newsletter ON public.publication_settings USING btree (publication_id);

CREATE INDEX idx_poll_modules_active ON public.poll_modules USING btree (publication_id, is_active);

CREATE INDEX idx_poll_modules_display_order ON public.poll_modules USING btree (publication_id, display_order);

CREATE INDEX idx_poll_modules_publication ON public.poll_modules USING btree (publication_id);

CREATE INDEX idx_poll_responses_email ON public.poll_responses USING btree (subscriber_email);

CREATE INDEX idx_poll_responses_ip_address ON public.poll_responses USING btree (ip_address);

CREATE INDEX idx_poll_responses_issue ON public.poll_responses USING btree (issue_id);

CREATE INDEX idx_poll_responses_poll ON public.poll_responses USING btree (poll_id);

CREATE INDEX idx_poll_responses_publication ON public.poll_responses USING btree (publication_id);

CREATE UNIQUE INDEX idx_poll_responses_unique_no_issue ON public.poll_responses USING btree (poll_id, subscriber_email) WHERE (issue_id IS NULL);

CREATE UNIQUE INDEX idx_poll_responses_unique_with_issue ON public.poll_responses USING btree (poll_id, subscriber_email, issue_id) WHERE (issue_id IS NOT NULL);

CREATE INDEX idx_polls_active ON public.polls USING btree (is_active);

CREATE INDEX idx_polls_publication ON public.polls USING btree (publication_id);

CREATE INDEX idx_polls_publication_active ON public.polls USING btree (publication_id, is_active);

CREATE INDEX idx_post_ratings_post ON public.post_ratings USING btree (post_id);

CREATE INDEX idx_post_ratings_post_id_score ON public.post_ratings USING btree (post_id, total_score DESC);

CREATE INDEX idx_post_ratings_score ON public.post_ratings USING btree (total_score);

CREATE INDEX idx_post_ratings_total_score ON public.post_ratings USING btree (total_score DESC);

CREATE INDEX idx_prompt_ideas_active ON public.prompt_ideas USING btree (is_active);

CREATE INDEX idx_prompt_ideas_category ON public.prompt_ideas USING btree (category);

CREATE INDEX idx_prompt_ideas_module ON public.prompt_ideas USING btree (prompt_module_id);

CREATE INDEX idx_prompt_ideas_newsletter ON public.prompt_ideas USING btree (publication_id);

CREATE INDEX idx_prompt_modules_active ON public.prompt_modules USING btree (publication_id, is_active);

CREATE INDEX idx_prompt_modules_display_order ON public.prompt_modules USING btree (publication_id, display_order);

CREATE INDEX idx_prompt_modules_publication ON public.prompt_modules USING btree (publication_id);

CREATE INDEX idx_publication_issues_poll ON public.publication_issues USING btree (poll_id);

CREATE INDEX idx_real_click_status_email ON public.subscriber_real_click_status USING btree (subscriber_email);

CREATE INDEX idx_real_click_status_has_click ON public.subscriber_real_click_status USING btree (publication_id, has_real_click);

CREATE INDEX idx_real_click_status_publication ON public.subscriber_real_click_status USING btree (publication_id);

CREATE INDEX idx_referrals_confirmed ON public.sparkloop_referrals USING btree (confirmed_at) WHERE (confirmed_at IS NOT NULL);

CREATE INDEX idx_referrals_pub_ref ON public.sparkloop_referrals USING btree (publication_id, ref_code);

CREATE INDEX idx_referrals_pub_source ON public.sparkloop_referrals USING btree (publication_id, source);

CREATE INDEX idx_referrals_pub_status ON public.sparkloop_referrals USING btree (publication_id, status);

CREATE INDEX idx_referrals_subscribed ON public.sparkloop_referrals USING btree (subscribed_at) WHERE (subscribed_at IS NOT NULL);

CREATE INDEX idx_rss_feeds_active ON public.rss_feeds USING btree (active);

CREATE INDEX idx_rss_feeds_module ON public.rss_feeds USING btree (article_module_id);

CREATE INDEX idx_rss_feeds_publication ON public.rss_feeds USING btree (publication_id);

CREATE INDEX idx_rss_posts_external ON public.rss_posts USING btree (external_id);

CREATE INDEX idx_rss_posts_extraction_status ON public.rss_posts USING btree (extraction_status);

CREATE INDEX idx_rss_posts_feed ON public.rss_posts USING btree (feed_id);

CREATE INDEX idx_rss_posts_final_priority_score ON public.rss_posts USING btree (final_priority_score DESC);

CREATE INDEX idx_rss_posts_issue ON public.rss_posts USING btree (issue_id);

CREATE INDEX idx_rss_posts_issue_priority ON public.rss_posts USING btree (issue_id, final_priority_score DESC);

CREATE INDEX idx_rss_posts_module ON public.rss_posts USING btree (article_module_id);

CREATE INDEX idx_secondary_articles_active ON public.secondary_articles USING btree (is_active) WHERE (is_active = true);

CREATE INDEX idx_secondary_articles_issue ON public.secondary_articles USING btree (issue_id);

CREATE INDEX idx_secondary_articles_post ON public.secondary_articles USING btree (post_id);

CREATE INDEX idx_sendgrid_updates_click ON public.sendgrid_field_updates USING btree (link_click_id);

CREATE INDEX idx_sendgrid_updates_email ON public.sendgrid_field_updates USING btree (subscriber_email);

CREATE INDEX idx_sendgrid_updates_issue ON public.sendgrid_field_updates USING btree (issue_id);

CREATE INDEX idx_sendgrid_updates_publication ON public.sendgrid_field_updates USING btree (publication_id);

CREATE INDEX idx_sendgrid_updates_status ON public.sendgrid_field_updates USING btree (status);

CREATE INDEX idx_sl_snapshots_lookup ON public.sparkloop_daily_snapshots USING btree (publication_id, ref_code, snapshot_date DESC);

CREATE INDEX idx_sparkloop_events_created ON public.sparkloop_events USING btree (created_at DESC);

CREATE INDEX idx_sparkloop_events_email ON public.sparkloop_events USING btree (subscriber_email);

CREATE INDEX idx_sparkloop_events_publication ON public.sparkloop_events USING btree (publication_id);

CREATE INDEX idx_sparkloop_events_type ON public.sparkloop_events USING btree (event_type);

CREATE INDEX idx_sparkloop_module_clicks_date ON public.sparkloop_module_clicks USING btree (clicked_at DESC);

CREATE INDEX idx_sparkloop_module_clicks_pub ON public.sparkloop_module_clicks USING btree (publication_id);

CREATE INDEX idx_sparkloop_module_clicks_ref ON public.sparkloop_module_clicks USING btree (ref_code);

CREATE INDEX idx_sparkloop_module_clicks_valid ON public.sparkloop_module_clicks USING btree (publication_id, ref_code, clicked_at DESC) WHERE ((is_ip_excluded = false) AND (is_bot_ua = false));

CREATE INDEX idx_sparkloop_offer_events_date ON public.sparkloop_offer_events USING btree (created_at);

CREATE INDEX idx_sparkloop_offer_events_pub ON public.sparkloop_offer_events USING btree (publication_id, offer_recommendation_id);

CREATE INDEX idx_sparkloop_rec_modules_pub ON public.sparkloop_rec_modules USING btree (publication_id) WHERE (is_active = true);

CREATE INDEX idx_sparkloop_recs_cpa ON public.sparkloop_recommendations USING btree (cpa DESC);

CREATE INDEX idx_sparkloop_recs_excluded ON public.sparkloop_recommendations USING btree (excluded);

CREATE INDEX idx_sparkloop_recs_module_eligible ON public.sparkloop_recommendations USING btree (publication_id, eligible_for_module) WHERE ((eligible_for_module = true) AND (status = 'active'::text) AND ((excluded = false) OR (excluded IS NULL)));

CREATE INDEX idx_sparkloop_recs_publication ON public.sparkloop_recommendations USING btree (publication_id);

CREATE INDEX idx_sparkloop_recs_ref_code ON public.sparkloop_recommendations USING btree (ref_code);

CREATE INDEX idx_sparkloop_recs_status ON public.sparkloop_recommendations USING btree (status);

CREATE INDEX idx_sparkloop_recs_type ON public.sparkloop_recommendations USING btree (type);

CREATE INDEX idx_system_logs_level ON public.system_logs USING btree (level);

CREATE INDEX idx_system_logs_timestamp ON public.system_logs USING btree ("timestamp");

CREATE INDEX idx_tdc_category ON public.tool_directory_clicks USING btree (category_slug) WHERE (category_slug IS NOT NULL);

CREATE INDEX idx_tdc_date ON public.tool_directory_clicks USING btree (clicked_at);

CREATE INDEX idx_tdc_pub_date ON public.tool_directory_clicks USING btree (publication_id, clicked_at);

CREATE INDEX idx_tdc_publication ON public.tool_directory_clicks USING btree (publication_id);

CREATE INDEX idx_tdc_tool ON public.tool_directory_clicks USING btree (tool_id) WHERE (tool_id IS NOT NULL);

CREATE INDEX idx_tdc_type ON public.tool_directory_clicks USING btree (click_type);

CREATE INDEX idx_text_box_blocks_module ON public.text_box_blocks USING btree (text_box_module_id);

CREATE INDEX idx_text_box_blocks_order ON public.text_box_blocks USING btree (text_box_module_id, display_order);

CREATE INDEX idx_text_box_blocks_timing ON public.text_box_blocks USING btree (generation_timing) WHERE (block_type = 'ai_prompt'::text);

CREATE INDEX idx_text_box_modules_active ON public.text_box_modules USING btree (publication_id, is_active);

CREATE INDEX idx_text_box_modules_display_order ON public.text_box_modules USING btree (publication_id, display_order);

CREATE INDEX idx_text_box_modules_publication ON public.text_box_modules USING btree (publication_id);

CREATE INDEX idx_tools_directory_clerk_user ON public.tools_directory USING btree (clerk_user_id);

CREATE INDEX idx_tools_directory_clerk_user_id ON public.tools_directory USING btree (clerk_user_id);

CREATE INDEX idx_tools_directory_publication ON public.tools_directory USING btree (publication_id);

CREATE INDEX idx_tools_directory_sponsored ON public.tools_directory USING btree (is_sponsored) WHERE (is_sponsored = true);

CREATE INDEX idx_tools_directory_status ON public.tools_directory USING btree (status);

CREATE INDEX idx_tools_directory_stripe_customer ON public.tools_directory USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX idx_tools_directory_stripe_subscription ON public.tools_directory USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);

CREATE INDEX idx_user_activities_issue ON public.user_activities USING btree (issue_id);

CREATE INDEX idx_user_activities_timestamp ON public.user_activities USING btree ("timestamp");

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE UNIQUE INDEX issue_advertisements_pkey ON public.issue_advertisements USING btree (id);

CREATE UNIQUE INDEX issue_ai_app_modules_issue_id_ai_app_module_id_key ON public.issue_ai_app_modules USING btree (issue_id, ai_app_module_id);

CREATE UNIQUE INDEX issue_ai_app_modules_pkey ON public.issue_ai_app_modules USING btree (id);

CREATE UNIQUE INDEX issue_ai_app_selections_issue_id_app_id_key ON public.issue_ai_app_selections USING btree (issue_id, app_id);

CREATE UNIQUE INDEX issue_ai_app_selections_issue_id_selection_order_key ON public.issue_ai_app_selections USING btree (issue_id, selection_order);

CREATE UNIQUE INDEX issue_ai_app_selections_pkey ON public.issue_ai_app_selections USING btree (id);

CREATE UNIQUE INDEX issue_article_modules_issue_id_article_module_id_key ON public.issue_article_modules USING btree (issue_id, article_module_id);

CREATE UNIQUE INDEX issue_article_modules_pkey ON public.issue_article_modules USING btree (id);

CREATE UNIQUE INDEX issue_breaking_news_issue_id_post_id_key ON public.issue_breaking_news USING btree (issue_id, post_id);

CREATE UNIQUE INDEX issue_breaking_news_pkey ON public.issue_breaking_news USING btree (id);

CREATE UNIQUE INDEX issue_events_pkey ON public.issue_events USING btree (id);

CREATE UNIQUE INDEX issue_module_ads_issue_id_ad_module_id_key ON public.issue_module_ads USING btree (issue_id, ad_module_id);

CREATE UNIQUE INDEX issue_module_ads_pkey ON public.issue_module_ads USING btree (id);

CREATE UNIQUE INDEX issue_poll_modules_issue_id_poll_module_id_key ON public.issue_poll_modules USING btree (issue_id, poll_module_id);

CREATE UNIQUE INDEX issue_poll_modules_pkey ON public.issue_poll_modules USING btree (id);

CREATE UNIQUE INDEX issue_prompt_modules_issue_id_prompt_module_id_key ON public.issue_prompt_modules USING btree (issue_id, prompt_module_id);

CREATE UNIQUE INDEX issue_prompt_modules_pkey ON public.issue_prompt_modules USING btree (id);

CREATE UNIQUE INDEX issue_prompt_selections_issue_id_prompt_id_key ON public.issue_prompt_selections USING btree (issue_id, prompt_id);

CREATE UNIQUE INDEX issue_prompt_selections_issue_id_selection_order_key ON public.issue_prompt_selections USING btree (issue_id, selection_order);

CREATE UNIQUE INDEX issue_prompt_selections_pkey ON public.issue_prompt_selections USING btree (id);

CREATE UNIQUE INDEX issue_sparkloop_rec_modules_issue_id_sparkloop_rec_module_i_key ON public.issue_sparkloop_rec_modules USING btree (issue_id, sparkloop_rec_module_id);

CREATE UNIQUE INDEX issue_sparkloop_rec_modules_pkey ON public.issue_sparkloop_rec_modules USING btree (id);

CREATE UNIQUE INDEX issue_text_box_blocks_issue_id_text_box_block_id_key ON public.issue_text_box_blocks USING btree (issue_id, text_box_block_id);

CREATE UNIQUE INDEX issue_text_box_blocks_pkey ON public.issue_text_box_blocks USING btree (id);

CREATE UNIQUE INDEX issue_text_box_modules_issue_id_text_box_module_id_key ON public.issue_text_box_modules USING btree (issue_id, text_box_module_id);

CREATE UNIQUE INDEX issue_text_box_modules_pkey ON public.issue_text_box_modules USING btree (id);

CREATE UNIQUE INDEX link_clicks_pkey ON public.link_clicks USING btree (id);

CREATE UNIQUE INDEX mailerlite_field_updates_pkey ON public.mailerlite_field_updates USING btree (id);

CREATE UNIQUE INDEX manual_articles_pkey ON public.manual_articles USING btree (id);

CREATE UNIQUE INDEX manual_articles_publication_id_slug_key ON public.manual_articles USING btree (publication_id, slug);

CREATE UNIQUE INDEX module_articles_pkey ON public.module_articles USING btree (id);

CREATE UNIQUE INDEX module_articles_post_id_issue_id_article_module_id_key ON public.module_articles USING btree (post_id, issue_id, article_module_id);

CREATE UNIQUE INDEX newsletter_sections_pkey ON public.newsletter_sections USING btree (id);

CREATE UNIQUE INDEX newsletter_settings_newsletter_id_key_key ON public.publication_settings USING btree (publication_id, key);

CREATE UNIQUE INDEX newsletter_settings_pkey ON public.publication_settings USING btree (id);

CREATE UNIQUE INDEX newsletter_settings_publication_id_key ON public.publication_settings USING btree (publication_id, key);

CREATE UNIQUE INDEX newsletters_pkey ON public.publications USING btree (id);

CREATE UNIQUE INDEX newsletters_slug_key ON public.publications USING btree (slug);

CREATE UNIQUE INDEX newsletters_subdomain_key ON public.publications USING btree (subdomain);

CREATE UNIQUE INDEX pending_event_submissions_pkey ON public.pending_event_submissions USING btree (id);

CREATE UNIQUE INDEX poll_excluded_ips_pkey ON public.excluded_ips USING btree (id);

CREATE UNIQUE INDEX poll_excluded_ips_publication_id_ip_address_key ON public.excluded_ips USING btree (publication_id, ip_address);

CREATE UNIQUE INDEX poll_modules_pkey ON public.poll_modules USING btree (id);

CREATE UNIQUE INDEX poll_responses_pkey ON public.poll_responses USING btree (id);

CREATE UNIQUE INDEX polls_pkey ON public.polls USING btree (id);

CREATE UNIQUE INDEX post_ratings_pkey ON public.post_ratings USING btree (id);

CREATE UNIQUE INDEX prompt_ideas_pkey ON public.prompt_ideas USING btree (id);

CREATE UNIQUE INDEX prompt_modules_pkey ON public.prompt_modules USING btree (id);

CREATE UNIQUE INDEX publication_issues_pkey ON public.publication_issues USING btree (id);

CREATE UNIQUE INDEX rss_feeds_pkey ON public.rss_feeds USING btree (id);

CREATE UNIQUE INDEX rss_posts_pkey ON public.rss_posts USING btree (id);

CREATE UNIQUE INDEX secondary_articles_pkey ON public.secondary_articles USING btree (id);

CREATE UNIQUE INDEX sendgrid_field_updates_pkey ON public.sendgrid_field_updates USING btree (id);

CREATE UNIQUE INDEX sparkloop_daily_snapshots_pkey ON public.sparkloop_daily_snapshots USING btree (id);

CREATE UNIQUE INDEX sparkloop_daily_snapshots_publication_id_ref_code_snapshot__key ON public.sparkloop_daily_snapshots USING btree (publication_id, ref_code, snapshot_date);

CREATE UNIQUE INDEX sparkloop_events_event_type_subscriber_email_event_timestam_key ON public.sparkloop_events USING btree (event_type, subscriber_email, event_timestamp);

CREATE UNIQUE INDEX sparkloop_events_pkey ON public.sparkloop_events USING btree (id);

CREATE UNIQUE INDEX sparkloop_module_clicks_pkey ON public.sparkloop_module_clicks USING btree (id);

CREATE UNIQUE INDEX sparkloop_offer_events_pkey ON public.sparkloop_offer_events USING btree (id);

CREATE UNIQUE INDEX sparkloop_rec_modules_pkey ON public.sparkloop_rec_modules USING btree (id);

CREATE UNIQUE INDEX sparkloop_recommendations_pkey ON public.sparkloop_recommendations USING btree (id);

CREATE UNIQUE INDEX sparkloop_recommendations_publication_id_ref_code_key ON public.sparkloop_recommendations USING btree (publication_id, ref_code);

CREATE UNIQUE INDEX sparkloop_referrals_pkey ON public.sparkloop_referrals USING btree (id);

CREATE UNIQUE INDEX sparkloop_referrals_publication_id_subscriber_email_ref_cod_key ON public.sparkloop_referrals USING btree (publication_id, subscriber_email, ref_code);

CREATE UNIQUE INDEX subscriber_real_click_status_pkey ON public.subscriber_real_click_status USING btree (id);

CREATE UNIQUE INDEX subscriber_real_click_status_publication_id_subscriber_emai_key ON public.subscriber_real_click_status USING btree (publication_id, subscriber_email);

CREATE UNIQUE INDEX system_logs_pkey ON public.system_logs USING btree (id);

CREATE UNIQUE INDEX text_box_blocks_pkey ON public.text_box_blocks USING btree (id);

CREATE UNIQUE INDEX text_box_modules_pkey ON public.text_box_modules USING btree (id);

CREATE UNIQUE INDEX tool_directory_clicks_pkey ON public.tool_directory_clicks USING btree (id);

CREATE UNIQUE INDEX tools_directory_pkey ON public.tools_directory USING btree (id);

CREATE UNIQUE INDEX unique_external_id ON public.rss_posts USING btree (external_id);

CREATE UNIQUE INDEX user_activities_pkey ON public.user_activities USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."ad_block_types" add constraint "ad_block_types_pkey" PRIMARY KEY using index "ad_block_types_pkey";

alter table "public"."ad_module_advertisers" add constraint "ad_module_advertisers_pkey" PRIMARY KEY using index "ad_module_advertisers_pkey";

alter table "public"."ad_modules" add constraint "ad_modules_pkey" PRIMARY KEY using index "ad_modules_pkey";

alter table "public"."ad_pricing_tiers" add constraint "ad_pricing_tiers_pkey" PRIMARY KEY using index "ad_pricing_tiers_pkey";

alter table "public"."advertisements" add constraint "advertisements_pkey" PRIMARY KEY using index "advertisements_pkey";

alter table "public"."advertisers" add constraint "advertisers_pkey" PRIMARY KEY using index "advertisers_pkey";

alter table "public"."ai_app_block_types" add constraint "ai_app_block_types_pkey" PRIMARY KEY using index "ai_app_block_types_pkey";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_pkey" PRIMARY KEY using index "ai_app_modules_pkey";

alter table "public"."ai_applications" add constraint "ai_applications_pkey" PRIMARY KEY using index "ai_applications_pkey";

alter table "public"."ai_prompt_tests" add constraint "ai_prompt_tests_pkey" PRIMARY KEY using index "ai_prompt_tests_pkey";

alter table "public"."app_settings" add constraint "app_settings_pkey" PRIMARY KEY using index "app_settings_pkey";

alter table "public"."archived_articles" add constraint "archived_articles_pkey" PRIMARY KEY using index "archived_articles_pkey";

alter table "public"."archived_newsletters" add constraint "archived_newsletters_pkey" PRIMARY KEY using index "archived_newsletters_pkey";

alter table "public"."archived_post_ratings" add constraint "archived_post_ratings_pkey" PRIMARY KEY using index "archived_post_ratings_pkey";

alter table "public"."archived_rss_posts" add constraint "archived_rss_posts_pkey" PRIMARY KEY using index "archived_rss_posts_pkey";

alter table "public"."archived_secondary_articles" add constraint "archived_secondary_articles_pkey" PRIMARY KEY using index "archived_secondary_articles_pkey";

alter table "public"."article_categories" add constraint "article_categories_pkey" PRIMARY KEY using index "article_categories_pkey";

alter table "public"."article_module_criteria" add constraint "article_module_criteria_pkey" PRIMARY KEY using index "article_module_criteria_pkey";

alter table "public"."article_module_prompts" add constraint "article_module_prompts_pkey" PRIMARY KEY using index "article_module_prompts_pkey";

alter table "public"."article_modules" add constraint "article_modules_pkey" PRIMARY KEY using index "article_modules_pkey";

alter table "public"."articles" add constraint "articles_pkey" PRIMARY KEY using index "articles_pkey";

alter table "public"."contact_submissions" add constraint "contact_submissions_pkey" PRIMARY KEY using index "contact_submissions_pkey";

alter table "public"."directory_categories" add constraint "directory_categories_pkey" PRIMARY KEY using index "directory_categories_pkey";

alter table "public"."directory_categories_tools" add constraint "directory_categories_tools_pkey" PRIMARY KEY using index "directory_categories_tools_pkey";

alter table "public"."duplicate_groups" add constraint "duplicate_groups_pkey" PRIMARY KEY using index "duplicate_groups_pkey";

alter table "public"."duplicate_posts" add constraint "duplicate_posts_pkey" PRIMARY KEY using index "duplicate_posts_pkey";

alter table "public"."email_metrics" add constraint "email_metrics_pkey" PRIMARY KEY using index "email_metrics_pkey";

alter table "public"."event_venues" add constraint "event_venues_pkey" PRIMARY KEY using index "event_venues_pkey";

alter table "public"."events" add constraint "events_pkey" PRIMARY KEY using index "events_pkey";

alter table "public"."excluded_ips" add constraint "poll_excluded_ips_pkey" PRIMARY KEY using index "poll_excluded_ips_pkey";

alter table "public"."feedback_blocks" add constraint "feedback_blocks_pkey" PRIMARY KEY using index "feedback_blocks_pkey";

alter table "public"."feedback_comment_read_status" add constraint "feedback_comment_read_status_pkey" PRIMARY KEY using index "feedback_comment_read_status_pkey";

alter table "public"."feedback_comments" add constraint "feedback_comments_pkey" PRIMARY KEY using index "feedback_comments_pkey";

alter table "public"."feedback_modules" add constraint "feedback_modules_pkey" PRIMARY KEY using index "feedback_modules_pkey";

alter table "public"."feedback_responses" add constraint "feedback_responses_pkey" PRIMARY KEY using index "feedback_responses_pkey";

alter table "public"."feedback_votes" add constraint "feedback_votes_pkey" PRIMARY KEY using index "feedback_votes_pkey";

alter table "public"."issue_advertisements" add constraint "issue_advertisements_pkey" PRIMARY KEY using index "issue_advertisements_pkey";

alter table "public"."issue_ai_app_modules" add constraint "issue_ai_app_modules_pkey" PRIMARY KEY using index "issue_ai_app_modules_pkey";

alter table "public"."issue_ai_app_selections" add constraint "issue_ai_app_selections_pkey" PRIMARY KEY using index "issue_ai_app_selections_pkey";

alter table "public"."issue_article_modules" add constraint "issue_article_modules_pkey" PRIMARY KEY using index "issue_article_modules_pkey";

alter table "public"."issue_breaking_news" add constraint "issue_breaking_news_pkey" PRIMARY KEY using index "issue_breaking_news_pkey";

alter table "public"."issue_events" add constraint "issue_events_pkey" PRIMARY KEY using index "issue_events_pkey";

alter table "public"."issue_module_ads" add constraint "issue_module_ads_pkey" PRIMARY KEY using index "issue_module_ads_pkey";

alter table "public"."issue_poll_modules" add constraint "issue_poll_modules_pkey" PRIMARY KEY using index "issue_poll_modules_pkey";

alter table "public"."issue_prompt_modules" add constraint "issue_prompt_modules_pkey" PRIMARY KEY using index "issue_prompt_modules_pkey";

alter table "public"."issue_prompt_selections" add constraint "issue_prompt_selections_pkey" PRIMARY KEY using index "issue_prompt_selections_pkey";

alter table "public"."issue_sparkloop_rec_modules" add constraint "issue_sparkloop_rec_modules_pkey" PRIMARY KEY using index "issue_sparkloop_rec_modules_pkey";

alter table "public"."issue_text_box_blocks" add constraint "issue_text_box_blocks_pkey" PRIMARY KEY using index "issue_text_box_blocks_pkey";

alter table "public"."issue_text_box_modules" add constraint "issue_text_box_modules_pkey" PRIMARY KEY using index "issue_text_box_modules_pkey";

alter table "public"."link_clicks" add constraint "link_clicks_pkey" PRIMARY KEY using index "link_clicks_pkey";

alter table "public"."mailerlite_field_updates" add constraint "mailerlite_field_updates_pkey" PRIMARY KEY using index "mailerlite_field_updates_pkey";

alter table "public"."manual_articles" add constraint "manual_articles_pkey" PRIMARY KEY using index "manual_articles_pkey";

alter table "public"."module_articles" add constraint "module_articles_pkey" PRIMARY KEY using index "module_articles_pkey";

alter table "public"."newsletter_sections" add constraint "newsletter_sections_pkey" PRIMARY KEY using index "newsletter_sections_pkey";

alter table "public"."pending_event_submissions" add constraint "pending_event_submissions_pkey" PRIMARY KEY using index "pending_event_submissions_pkey";

alter table "public"."poll_modules" add constraint "poll_modules_pkey" PRIMARY KEY using index "poll_modules_pkey";

alter table "public"."poll_responses" add constraint "poll_responses_pkey" PRIMARY KEY using index "poll_responses_pkey";

alter table "public"."polls" add constraint "polls_pkey" PRIMARY KEY using index "polls_pkey";

alter table "public"."post_ratings" add constraint "post_ratings_pkey" PRIMARY KEY using index "post_ratings_pkey";

alter table "public"."prompt_ideas" add constraint "prompt_ideas_pkey" PRIMARY KEY using index "prompt_ideas_pkey";

alter table "public"."prompt_modules" add constraint "prompt_modules_pkey" PRIMARY KEY using index "prompt_modules_pkey";

alter table "public"."publication_issues" add constraint "publication_issues_pkey" PRIMARY KEY using index "publication_issues_pkey";

alter table "public"."publication_settings" add constraint "newsletter_settings_pkey" PRIMARY KEY using index "newsletter_settings_pkey";

alter table "public"."publications" add constraint "newsletters_pkey" PRIMARY KEY using index "newsletters_pkey";

alter table "public"."rss_feeds" add constraint "rss_feeds_pkey" PRIMARY KEY using index "rss_feeds_pkey";

alter table "public"."rss_posts" add constraint "rss_posts_pkey" PRIMARY KEY using index "rss_posts_pkey";

alter table "public"."secondary_articles" add constraint "secondary_articles_pkey" PRIMARY KEY using index "secondary_articles_pkey";

alter table "public"."sendgrid_field_updates" add constraint "sendgrid_field_updates_pkey" PRIMARY KEY using index "sendgrid_field_updates_pkey";

alter table "public"."sparkloop_daily_snapshots" add constraint "sparkloop_daily_snapshots_pkey" PRIMARY KEY using index "sparkloop_daily_snapshots_pkey";

alter table "public"."sparkloop_events" add constraint "sparkloop_events_pkey" PRIMARY KEY using index "sparkloop_events_pkey";

alter table "public"."sparkloop_module_clicks" add constraint "sparkloop_module_clicks_pkey" PRIMARY KEY using index "sparkloop_module_clicks_pkey";

alter table "public"."sparkloop_offer_events" add constraint "sparkloop_offer_events_pkey" PRIMARY KEY using index "sparkloop_offer_events_pkey";

alter table "public"."sparkloop_rec_modules" add constraint "sparkloop_rec_modules_pkey" PRIMARY KEY using index "sparkloop_rec_modules_pkey";

alter table "public"."sparkloop_recommendations" add constraint "sparkloop_recommendations_pkey" PRIMARY KEY using index "sparkloop_recommendations_pkey";

alter table "public"."sparkloop_referrals" add constraint "sparkloop_referrals_pkey" PRIMARY KEY using index "sparkloop_referrals_pkey";

alter table "public"."subscriber_real_click_status" add constraint "subscriber_real_click_status_pkey" PRIMARY KEY using index "subscriber_real_click_status_pkey";

alter table "public"."system_logs" add constraint "system_logs_pkey" PRIMARY KEY using index "system_logs_pkey";

alter table "public"."text_box_blocks" add constraint "text_box_blocks_pkey" PRIMARY KEY using index "text_box_blocks_pkey";

alter table "public"."text_box_modules" add constraint "text_box_modules_pkey" PRIMARY KEY using index "text_box_modules_pkey";

alter table "public"."tool_directory_clicks" add constraint "tool_directory_clicks_pkey" PRIMARY KEY using index "tool_directory_clicks_pkey";

alter table "public"."tools_directory" add constraint "tools_directory_pkey" PRIMARY KEY using index "tools_directory_pkey";

alter table "public"."user_activities" add constraint "user_activities_pkey" PRIMARY KEY using index "user_activities_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."ad_block_types" add constraint "ad_block_types_name_key" UNIQUE using index "ad_block_types_name_key";

alter table "public"."ad_module_advertisers" add constraint "ad_module_advertisers_ad_module_id_advertiser_id_key" UNIQUE using index "ad_module_advertisers_ad_module_id_advertiser_id_key";

alter table "public"."ad_module_advertisers" add constraint "ad_module_advertisers_ad_module_id_fkey" FOREIGN KEY (ad_module_id) REFERENCES public.ad_modules(id) ON DELETE CASCADE not valid;

alter table "public"."ad_module_advertisers" validate constraint "ad_module_advertisers_ad_module_id_fkey";

alter table "public"."ad_module_advertisers" add constraint "ad_module_advertisers_advertiser_id_fkey" FOREIGN KEY (advertiser_id) REFERENCES public.advertisers(id) ON DELETE CASCADE not valid;

alter table "public"."ad_module_advertisers" validate constraint "ad_module_advertisers_advertiser_id_fkey";

alter table "public"."ad_modules" add constraint "ad_modules_selection_mode_check" CHECK ((selection_mode = ANY (ARRAY['sequential'::text, 'random'::text, 'priority'::text, 'manual'::text]))) not valid;

alter table "public"."ad_modules" validate constraint "ad_modules_selection_mode_check";

alter table "public"."advertisements" add constraint "advertisements_ad_module_id_fkey" FOREIGN KEY (ad_module_id) REFERENCES public.ad_modules(id) ON DELETE SET NULL not valid;

alter table "public"."advertisements" validate constraint "advertisements_ad_module_id_fkey";

alter table "public"."advertisements" add constraint "advertisements_advertiser_id_fkey" FOREIGN KEY (advertiser_id) REFERENCES public.advertisers(id) ON DELETE SET NULL not valid;

alter table "public"."advertisements" validate constraint "advertisements_advertiser_id_fkey";

alter table "public"."advertisements" add constraint "advertisements_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."advertisements" validate constraint "advertisements_newsletter_id_fkey";

alter table "public"."ai_app_block_types" add constraint "ai_app_block_types_name_key" UNIQUE using index "ai_app_block_types_name_key";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_description_size_check" CHECK ((description_size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text]))) not valid;

alter table "public"."ai_app_modules" validate constraint "ai_app_modules_description_size_check";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_layout_mode_check" CHECK ((layout_mode = ANY (ARRAY['stacked'::text, 'inline'::text]))) not valid;

alter table "public"."ai_app_modules" validate constraint "ai_app_modules_layout_mode_check";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_logo_style_check" CHECK ((logo_style = ANY (ARRAY['round'::text, 'square'::text]))) not valid;

alter table "public"."ai_app_modules" validate constraint "ai_app_modules_logo_style_check";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."ai_app_modules" validate constraint "ai_app_modules_publication_id_fkey";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_selection_mode_check" CHECK ((selection_mode = ANY (ARRAY['affiliate_priority'::text, 'random'::text, 'manual'::text]))) not valid;

alter table "public"."ai_app_modules" validate constraint "ai_app_modules_selection_mode_check";

alter table "public"."ai_app_modules" add constraint "ai_app_modules_title_size_check" CHECK ((title_size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text]))) not valid;

alter table "public"."ai_app_modules" validate constraint "ai_app_modules_title_size_check";

alter table "public"."ai_applications" add constraint "ai_applications_ai_app_module_id_fkey" FOREIGN KEY (ai_app_module_id) REFERENCES public.ai_app_modules(id) ON DELETE SET NULL not valid;

alter table "public"."ai_applications" validate constraint "ai_applications_ai_app_module_id_fkey";

alter table "public"."ai_applications" add constraint "ai_applications_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."ai_applications" validate constraint "ai_applications_newsletter_id_fkey";

alter table "public"."ai_applications" add constraint "ai_applications_pinned_position_check" CHECK (((pinned_position IS NULL) OR ((pinned_position >= 1) AND (pinned_position <= 20)))) not valid;

alter table "public"."ai_applications" validate constraint "ai_applications_pinned_position_check";

alter table "public"."ai_applications" add constraint "ai_applications_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'monthly'::text, 'yearly'::text]))) not valid;

alter table "public"."ai_applications" validate constraint "ai_applications_plan_check";

alter table "public"."ai_applications" add constraint "ai_applications_submission_status_check" CHECK ((submission_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'edited'::text]))) not valid;

alter table "public"."ai_applications" validate constraint "ai_applications_submission_status_check";

alter table "public"."ai_prompt_tests" add constraint "ai_prompt_tests_prompt_type_check" CHECK (((prompt_type = ANY (ARRAY['primary-title'::text, 'primary-body'::text, 'secondary-title'::text, 'secondary-body'::text, 'post-scorer'::text, 'subject-line'::text, 'custom'::text])) OR (prompt_type ~~ 'module-%'::text))) not valid;

alter table "public"."ai_prompt_tests" validate constraint "ai_prompt_tests_prompt_type_check";

alter table "public"."ai_prompt_tests" add constraint "ai_prompt_tests_provider_check" CHECK ((provider = ANY (ARRAY['openai'::text, 'claude'::text]))) not valid;

alter table "public"."ai_prompt_tests" validate constraint "ai_prompt_tests_provider_check";

alter table "public"."ai_prompt_tests" add constraint "ai_prompt_tests_user_id_newsletter_id_provider_model_prompt_key" UNIQUE using index "ai_prompt_tests_user_id_newsletter_id_provider_model_prompt_key";

alter table "public"."ai_prompt_tests" add constraint "ai_prompt_tests_user_id_publication_id_provider_model_prompt_t_" UNIQUE using index "ai_prompt_tests_user_id_publication_id_provider_model_prompt_t_";

alter table "public"."app_settings" add constraint "app_settings_ai_provider_check" CHECK ((ai_provider = ANY (ARRAY['openai'::text, 'claude'::text]))) not valid;

alter table "public"."app_settings" validate constraint "app_settings_ai_provider_check";

alter table "public"."app_settings" add constraint "app_settings_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) not valid;

alter table "public"."app_settings" validate constraint "app_settings_newsletter_id_fkey";

alter table "public"."archived_newsletters" add constraint "archived_newsletters_issue_id_key" UNIQUE using index "archived_newsletters_issue_id_key";

alter table "public"."archived_newsletters" add constraint "archived_newsletters_publication_id_issue_date_key" UNIQUE using index "archived_newsletters_publication_id_issue_date_key";

alter table "public"."archived_post_ratings" add constraint "archived_post_ratings_archived_post_id_fkey" FOREIGN KEY (archived_post_id) REFERENCES public.archived_rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."archived_post_ratings" validate constraint "archived_post_ratings_archived_post_id_fkey";

alter table "public"."article_categories" add constraint "article_categories_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."article_categories" validate constraint "article_categories_publication_id_fkey";

alter table "public"."article_categories" add constraint "article_categories_publication_id_slug_key" UNIQUE using index "article_categories_publication_id_slug_key";

alter table "public"."article_module_criteria" add constraint "article_module_criteria_article_module_id_criteria_number_key" UNIQUE using index "article_module_criteria_article_module_id_criteria_number_key";

alter table "public"."article_module_criteria" add constraint "article_module_criteria_article_module_id_fkey" FOREIGN KEY (article_module_id) REFERENCES public.article_modules(id) ON DELETE CASCADE not valid;

alter table "public"."article_module_criteria" validate constraint "article_module_criteria_article_module_id_fkey";

alter table "public"."article_module_criteria" add constraint "article_module_criteria_criteria_number_check" CHECK (((criteria_number >= 1) AND (criteria_number <= 5))) not valid;

alter table "public"."article_module_criteria" validate constraint "article_module_criteria_criteria_number_check";

alter table "public"."article_module_criteria" add constraint "article_module_criteria_minimum_score_check" CHECK (((minimum_score IS NULL) OR ((minimum_score >= 0) AND (minimum_score <= 10)))) not valid;

alter table "public"."article_module_criteria" validate constraint "article_module_criteria_minimum_score_check";

alter table "public"."article_module_prompts" add constraint "article_module_prompts_article_module_id_fkey" FOREIGN KEY (article_module_id) REFERENCES public.article_modules(id) ON DELETE CASCADE not valid;

alter table "public"."article_module_prompts" validate constraint "article_module_prompts_article_module_id_fkey";

alter table "public"."article_module_prompts" add constraint "article_module_prompts_article_module_id_prompt_type_key" UNIQUE using index "article_module_prompts_article_module_id_prompt_type_key";

alter table "public"."article_module_prompts" add constraint "article_module_prompts_prompt_type_check" CHECK ((prompt_type = ANY (ARRAY['article_title'::text, 'article_body'::text]))) not valid;

alter table "public"."article_module_prompts" validate constraint "article_module_prompts_prompt_type_check";

alter table "public"."article_modules" add constraint "article_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."article_modules" validate constraint "article_modules_publication_id_fkey";

alter table "public"."article_modules" add constraint "article_modules_selection_mode_check" CHECK ((selection_mode = ANY (ARRAY['top_score'::text, 'manual'::text]))) not valid;

alter table "public"."article_modules" validate constraint "article_modules_selection_mode_check";

alter table "public"."articles" add constraint "articles_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."articles" validate constraint "articles_issue_id_fkey";

alter table "public"."articles" add constraint "articles_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."articles" validate constraint "articles_post_id_fkey";

alter table "public"."contact_submissions" add constraint "contact_submissions_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) not valid;

alter table "public"."contact_submissions" validate constraint "contact_submissions_publication_id_fkey";

alter table "public"."contact_submissions" add constraint "contact_submissions_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'archived'::text]))) not valid;

alter table "public"."contact_submissions" validate constraint "contact_submissions_status_check";

alter table "public"."directory_categories" add constraint "directory_categories_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) not valid;

alter table "public"."directory_categories" validate constraint "directory_categories_publication_id_fkey";

alter table "public"."directory_categories" add constraint "directory_categories_publication_id_slug_key" UNIQUE using index "directory_categories_publication_id_slug_key";

alter table "public"."directory_categories" add constraint "directory_categories_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."directory_categories" validate constraint "directory_categories_status_check";

alter table "public"."directory_categories_tools" add constraint "directory_categories_tools_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.directory_categories(id) ON DELETE CASCADE not valid;

alter table "public"."directory_categories_tools" validate constraint "directory_categories_tools_category_id_fkey";

alter table "public"."directory_categories_tools" add constraint "directory_categories_tools_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools_directory(id) ON DELETE CASCADE not valid;

alter table "public"."directory_categories_tools" validate constraint "directory_categories_tools_tool_id_fkey";

alter table "public"."duplicate_groups" add constraint "duplicate_groups_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."duplicate_groups" validate constraint "duplicate_groups_issue_id_fkey";

alter table "public"."duplicate_groups" add constraint "duplicate_groups_primary_post_id_fkey" FOREIGN KEY (primary_post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."duplicate_groups" validate constraint "duplicate_groups_primary_post_id_fkey";

alter table "public"."duplicate_posts" add constraint "check_detection_method" CHECK (((detection_method)::text = ANY ((ARRAY['historical_match'::character varying, 'content_hash'::character varying, 'title_similarity'::character varying, 'ai_semantic'::character varying, 'ai_cross_section'::character varying])::text[]))) not valid;

alter table "public"."duplicate_posts" validate constraint "check_detection_method";

alter table "public"."duplicate_posts" add constraint "duplicate_posts_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.duplicate_groups(id) ON DELETE CASCADE not valid;

alter table "public"."duplicate_posts" validate constraint "duplicate_posts_group_id_fkey";

alter table "public"."duplicate_posts" add constraint "duplicate_posts_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."duplicate_posts" validate constraint "duplicate_posts_post_id_fkey";

alter table "public"."email_metrics" add constraint "email_metrics_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."email_metrics" validate constraint "email_metrics_issue_id_fkey";

alter table "public"."event_venues" add constraint "event_venues_name_key" UNIQUE using index "event_venues_name_key";

alter table "public"."events" add constraint "events_newsletter_id_fkey" FOREIGN KEY (newsletter_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."events" validate constraint "events_newsletter_id_fkey";

alter table "public"."excluded_ips" add constraint "check_cidr_prefix" CHECK ((((is_range = false) AND (cidr_prefix IS NULL)) OR ((is_range = true) AND (cidr_prefix IS NOT NULL) AND (cidr_prefix >= 0) AND (cidr_prefix <= 128)))) not valid;

alter table "public"."excluded_ips" validate constraint "check_cidr_prefix";

alter table "public"."excluded_ips" add constraint "excluded_ips_exclusion_source_check" CHECK ((exclusion_source = ANY (ARRAY['manual'::text, 'velocity'::text, 'honeypot'::text]))) not valid;

alter table "public"."excluded_ips" validate constraint "excluded_ips_exclusion_source_check";

alter table "public"."excluded_ips" add constraint "poll_excluded_ips_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."excluded_ips" validate constraint "poll_excluded_ips_publication_id_fkey";

alter table "public"."excluded_ips" add constraint "poll_excluded_ips_publication_id_ip_address_key" UNIQUE using index "poll_excluded_ips_publication_id_ip_address_key";

alter table "public"."feedback_blocks" add constraint "feedback_blocks_block_type_check" CHECK ((block_type = ANY (ARRAY['title'::text, 'static_text'::text, 'vote_options'::text, 'team_photos'::text]))) not valid;

alter table "public"."feedback_blocks" validate constraint "feedback_blocks_block_type_check";

alter table "public"."feedback_blocks" add constraint "feedback_blocks_feedback_module_id_fkey" FOREIGN KEY (feedback_module_id) REFERENCES public.feedback_modules(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_blocks" validate constraint "feedback_blocks_feedback_module_id_fkey";

alter table "public"."feedback_blocks" add constraint "feedback_blocks_text_size_check" CHECK ((text_size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text]))) not valid;

alter table "public"."feedback_blocks" validate constraint "feedback_blocks_text_size_check";

alter table "public"."feedback_comment_read_status" add constraint "feedback_comment_read_status_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES public.feedback_comments(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_comment_read_status" validate constraint "feedback_comment_read_status_comment_id_fkey";

alter table "public"."feedback_comment_read_status" add constraint "feedback_comment_read_status_comment_id_user_id_key" UNIQUE using index "feedback_comment_read_status_comment_id_user_id_key";

alter table "public"."feedback_comments" add constraint "feedback_comments_feedback_vote_id_fkey" FOREIGN KEY (feedback_vote_id) REFERENCES public.feedback_votes(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_comments" validate constraint "feedback_comments_feedback_vote_id_fkey";

alter table "public"."feedback_comments" add constraint "feedback_comments_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_comments" validate constraint "feedback_comments_publication_id_fkey";

alter table "public"."feedback_modules" add constraint "feedback_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_modules" validate constraint "feedback_modules_publication_id_fkey";

alter table "public"."feedback_modules" add constraint "feedback_modules_publication_id_key" UNIQUE using index "feedback_modules_publication_id_key";

alter table "public"."feedback_votes" add constraint "feedback_votes_feedback_module_id_fkey" FOREIGN KEY (feedback_module_id) REFERENCES public.feedback_modules(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_votes" validate constraint "feedback_votes_feedback_module_id_fkey";

alter table "public"."feedback_votes" add constraint "feedback_votes_feedback_module_id_subscriber_email_issue_id_key" UNIQUE using index "feedback_votes_feedback_module_id_subscriber_email_issue_id_key";

alter table "public"."feedback_votes" add constraint "feedback_votes_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_votes" validate constraint "feedback_votes_publication_id_fkey";

alter table "public"."issue_advertisements" add constraint "campaign_advertisements_advertisement_id_fkey" FOREIGN KEY (advertisement_id) REFERENCES public.advertisements(id) ON DELETE CASCADE not valid;

alter table "public"."issue_advertisements" validate constraint "campaign_advertisements_advertisement_id_fkey";

alter table "public"."issue_advertisements" add constraint "issue_advertisements_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."issue_advertisements" validate constraint "issue_advertisements_issue_id_fkey";

alter table "public"."issue_ai_app_modules" add constraint "issue_ai_app_modules_ai_app_module_id_fkey" FOREIGN KEY (ai_app_module_id) REFERENCES public.ai_app_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_ai_app_modules" validate constraint "issue_ai_app_modules_ai_app_module_id_fkey";

alter table "public"."issue_ai_app_modules" add constraint "issue_ai_app_modules_issue_id_ai_app_module_id_key" UNIQUE using index "issue_ai_app_modules_issue_id_ai_app_module_id_key";

alter table "public"."issue_ai_app_selections" add constraint "campaign_ai_app_selections_app_id_fkey" FOREIGN KEY (app_id) REFERENCES public.ai_applications(id) ON DELETE CASCADE not valid;

alter table "public"."issue_ai_app_selections" validate constraint "campaign_ai_app_selections_app_id_fkey";

alter table "public"."issue_ai_app_selections" add constraint "issue_ai_app_selections_issue_id_app_id_key" UNIQUE using index "issue_ai_app_selections_issue_id_app_id_key";

alter table "public"."issue_ai_app_selections" add constraint "issue_ai_app_selections_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."issue_ai_app_selections" validate constraint "issue_ai_app_selections_issue_id_fkey";

alter table "public"."issue_ai_app_selections" add constraint "issue_ai_app_selections_issue_id_selection_order_key" UNIQUE using index "issue_ai_app_selections_issue_id_selection_order_key";

alter table "public"."issue_article_modules" add constraint "issue_article_modules_article_module_id_fkey" FOREIGN KEY (article_module_id) REFERENCES public.article_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_article_modules" validate constraint "issue_article_modules_article_module_id_fkey";

alter table "public"."issue_article_modules" add constraint "issue_article_modules_issue_id_article_module_id_key" UNIQUE using index "issue_article_modules_issue_id_article_module_id_key";

alter table "public"."issue_breaking_news" add constraint "campaign_breaking_news_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."issue_breaking_news" validate constraint "campaign_breaking_news_post_id_fkey";

alter table "public"."issue_breaking_news" add constraint "campaign_breaking_news_section_check" CHECK ((section = ANY (ARRAY['breaking'::text, 'beyond_feed'::text]))) not valid;

alter table "public"."issue_breaking_news" validate constraint "campaign_breaking_news_section_check";

alter table "public"."issue_breaking_news" add constraint "issue_breaking_news_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."issue_breaking_news" validate constraint "issue_breaking_news_issue_id_fkey";

alter table "public"."issue_breaking_news" add constraint "issue_breaking_news_issue_id_post_id_key" UNIQUE using index "issue_breaking_news_issue_id_post_id_key";

alter table "public"."issue_events" add constraint "campaign_events_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE not valid;

alter table "public"."issue_events" validate constraint "campaign_events_event_id_fkey";

alter table "public"."issue_events" add constraint "issue_events_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."issue_events" validate constraint "issue_events_issue_id_fkey";

alter table "public"."issue_module_ads" add constraint "issue_module_ads_ad_module_id_fkey" FOREIGN KEY (ad_module_id) REFERENCES public.ad_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_module_ads" validate constraint "issue_module_ads_ad_module_id_fkey";

alter table "public"."issue_module_ads" add constraint "issue_module_ads_advertisement_id_fkey" FOREIGN KEY (advertisement_id) REFERENCES public.advertisements(id) ON DELETE SET NULL not valid;

alter table "public"."issue_module_ads" validate constraint "issue_module_ads_advertisement_id_fkey";

alter table "public"."issue_module_ads" add constraint "issue_module_ads_issue_id_ad_module_id_key" UNIQUE using index "issue_module_ads_issue_id_ad_module_id_key";

alter table "public"."issue_poll_modules" add constraint "issue_poll_modules_issue_id_poll_module_id_key" UNIQUE using index "issue_poll_modules_issue_id_poll_module_id_key";

alter table "public"."issue_poll_modules" add constraint "issue_poll_modules_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE SET NULL not valid;

alter table "public"."issue_poll_modules" validate constraint "issue_poll_modules_poll_id_fkey";

alter table "public"."issue_poll_modules" add constraint "issue_poll_modules_poll_module_id_fkey" FOREIGN KEY (poll_module_id) REFERENCES public.poll_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_poll_modules" validate constraint "issue_poll_modules_poll_module_id_fkey";

alter table "public"."issue_prompt_modules" add constraint "issue_prompt_modules_issue_id_prompt_module_id_key" UNIQUE using index "issue_prompt_modules_issue_id_prompt_module_id_key";

alter table "public"."issue_prompt_modules" add constraint "issue_prompt_modules_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES public.prompt_ideas(id) ON DELETE SET NULL not valid;

alter table "public"."issue_prompt_modules" validate constraint "issue_prompt_modules_prompt_id_fkey";

alter table "public"."issue_prompt_modules" add constraint "issue_prompt_modules_prompt_module_id_fkey" FOREIGN KEY (prompt_module_id) REFERENCES public.prompt_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_prompt_modules" validate constraint "issue_prompt_modules_prompt_module_id_fkey";

alter table "public"."issue_prompt_selections" add constraint "campaign_prompt_selections_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES public.prompt_ideas(id) ON DELETE CASCADE not valid;

alter table "public"."issue_prompt_selections" validate constraint "campaign_prompt_selections_prompt_id_fkey";

alter table "public"."issue_prompt_selections" add constraint "issue_prompt_selections_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."issue_prompt_selections" validate constraint "issue_prompt_selections_issue_id_fkey";

alter table "public"."issue_prompt_selections" add constraint "issue_prompt_selections_issue_id_prompt_id_key" UNIQUE using index "issue_prompt_selections_issue_id_prompt_id_key";

alter table "public"."issue_prompt_selections" add constraint "issue_prompt_selections_issue_id_selection_order_key" UNIQUE using index "issue_prompt_selections_issue_id_selection_order_key";

alter table "public"."issue_sparkloop_rec_modules" add constraint "issue_sparkloop_rec_modules_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."issue_sparkloop_rec_modules" validate constraint "issue_sparkloop_rec_modules_issue_id_fkey";

alter table "public"."issue_sparkloop_rec_modules" add constraint "issue_sparkloop_rec_modules_issue_id_sparkloop_rec_module_i_key" UNIQUE using index "issue_sparkloop_rec_modules_issue_id_sparkloop_rec_module_i_key";

alter table "public"."issue_sparkloop_rec_modules" add constraint "issue_sparkloop_rec_modules_sparkloop_rec_module_id_fkey" FOREIGN KEY (sparkloop_rec_module_id) REFERENCES public.sparkloop_rec_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_sparkloop_rec_modules" validate constraint "issue_sparkloop_rec_modules_sparkloop_rec_module_id_fkey";

alter table "public"."issue_text_box_blocks" add constraint "issue_text_box_blocks_generation_status_check" CHECK ((generation_status = ANY (ARRAY['pending'::text, 'generating'::text, 'completed'::text, 'failed'::text, 'manual'::text]))) not valid;

alter table "public"."issue_text_box_blocks" validate constraint "issue_text_box_blocks_generation_status_check";

alter table "public"."issue_text_box_blocks" add constraint "issue_text_box_blocks_issue_id_text_box_block_id_key" UNIQUE using index "issue_text_box_blocks_issue_id_text_box_block_id_key";

alter table "public"."issue_text_box_blocks" add constraint "issue_text_box_blocks_text_box_block_id_fkey" FOREIGN KEY (text_box_block_id) REFERENCES public.text_box_blocks(id) ON DELETE CASCADE not valid;

alter table "public"."issue_text_box_blocks" validate constraint "issue_text_box_blocks_text_box_block_id_fkey";

alter table "public"."issue_text_box_modules" add constraint "issue_text_box_modules_issue_id_text_box_module_id_key" UNIQUE using index "issue_text_box_modules_issue_id_text_box_module_id_key";

alter table "public"."issue_text_box_modules" add constraint "issue_text_box_modules_text_box_module_id_fkey" FOREIGN KEY (text_box_module_id) REFERENCES public.text_box_modules(id) ON DELETE CASCADE not valid;

alter table "public"."issue_text_box_modules" validate constraint "issue_text_box_modules_text_box_module_id_fkey";

alter table "public"."link_clicks" add constraint "link_clicks_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."link_clicks" validate constraint "link_clicks_issue_id_fkey";

alter table "public"."link_clicks" add constraint "link_clicks_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."link_clicks" validate constraint "link_clicks_publication_id_fkey";

alter table "public"."manual_articles" add constraint "manual_articles_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.article_categories(id) ON DELETE SET NULL not valid;

alter table "public"."manual_articles" validate constraint "manual_articles_category_id_fkey";

alter table "public"."manual_articles" add constraint "manual_articles_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."manual_articles" validate constraint "manual_articles_publication_id_fkey";

alter table "public"."manual_articles" add constraint "manual_articles_publication_id_slug_key" UNIQUE using index "manual_articles_publication_id_slug_key";

alter table "public"."manual_articles" add constraint "manual_articles_section_type_check" CHECK ((section_type = ANY (ARRAY['primary_articles'::text, 'secondary_articles'::text]))) not valid;

alter table "public"."manual_articles" validate constraint "manual_articles_section_type_check";

alter table "public"."manual_articles" add constraint "manual_articles_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'used'::text]))) not valid;

alter table "public"."manual_articles" validate constraint "manual_articles_status_check";

alter table "public"."manual_articles" add constraint "manual_articles_used_in_issue_id_fkey" FOREIGN KEY (used_in_issue_id) REFERENCES public.publication_issues(id) ON DELETE SET NULL not valid;

alter table "public"."manual_articles" validate constraint "manual_articles_used_in_issue_id_fkey";

alter table "public"."module_articles" add constraint "module_articles_article_module_id_fkey" FOREIGN KEY (article_module_id) REFERENCES public.article_modules(id) ON DELETE CASCADE not valid;

alter table "public"."module_articles" validate constraint "module_articles_article_module_id_fkey";

alter table "public"."module_articles" add constraint "module_articles_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."module_articles" validate constraint "module_articles_issue_id_fkey";

alter table "public"."module_articles" add constraint "module_articles_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."module_articles" validate constraint "module_articles_post_id_fkey";

alter table "public"."module_articles" add constraint "module_articles_post_id_issue_id_article_module_id_key" UNIQUE using index "module_articles_post_id_issue_id_article_module_id_key";

alter table "public"."newsletter_sections" add constraint "newsletter_sections_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."newsletter_sections" validate constraint "newsletter_sections_newsletter_id_fkey";

alter table "public"."poll_modules" add constraint "poll_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."poll_modules" validate constraint "poll_modules_publication_id_fkey";

alter table "public"."poll_responses" add constraint "poll_responses_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE SET NULL not valid;

alter table "public"."poll_responses" validate constraint "poll_responses_issue_id_fkey";

alter table "public"."poll_responses" add constraint "poll_responses_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."poll_responses" validate constraint "poll_responses_poll_id_fkey";

alter table "public"."poll_responses" add constraint "poll_responses_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."poll_responses" validate constraint "poll_responses_publication_id_fkey";

alter table "public"."polls" add constraint "polls_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."polls" validate constraint "polls_publication_id_fkey";

alter table "public"."post_ratings" add constraint "post_ratings_criteria_1_score_check" CHECK (((criteria_1_score >= 0) AND (criteria_1_score <= 10))) not valid;

alter table "public"."post_ratings" validate constraint "post_ratings_criteria_1_score_check";

alter table "public"."post_ratings" add constraint "post_ratings_criteria_2_score_check" CHECK (((criteria_2_score >= 0) AND (criteria_2_score <= 10))) not valid;

alter table "public"."post_ratings" validate constraint "post_ratings_criteria_2_score_check";

alter table "public"."post_ratings" add constraint "post_ratings_criteria_3_score_check" CHECK (((criteria_3_score >= 0) AND (criteria_3_score <= 10))) not valid;

alter table "public"."post_ratings" validate constraint "post_ratings_criteria_3_score_check";

alter table "public"."post_ratings" add constraint "post_ratings_criteria_4_score_check" CHECK (((criteria_4_score >= 0) AND (criteria_4_score <= 10))) not valid;

alter table "public"."post_ratings" validate constraint "post_ratings_criteria_4_score_check";

alter table "public"."post_ratings" add constraint "post_ratings_criteria_5_score_check" CHECK (((criteria_5_score >= 0) AND (criteria_5_score <= 10))) not valid;

alter table "public"."post_ratings" validate constraint "post_ratings_criteria_5_score_check";

alter table "public"."post_ratings" add constraint "post_ratings_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."post_ratings" validate constraint "post_ratings_post_id_fkey";

alter table "public"."prompt_ideas" add constraint "prompt_ideas_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."prompt_ideas" validate constraint "prompt_ideas_newsletter_id_fkey";

alter table "public"."prompt_ideas" add constraint "prompt_ideas_prompt_module_id_fkey" FOREIGN KEY (prompt_module_id) REFERENCES public.prompt_modules(id) ON DELETE SET NULL not valid;

alter table "public"."prompt_ideas" validate constraint "prompt_ideas_prompt_module_id_fkey";

alter table "public"."prompt_modules" add constraint "prompt_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."prompt_modules" validate constraint "prompt_modules_publication_id_fkey";

alter table "public"."prompt_modules" add constraint "prompt_modules_selection_mode_check" CHECK ((selection_mode = ANY (ARRAY['sequential'::text, 'random'::text, 'priority'::text, 'manual'::text]))) not valid;

alter table "public"."prompt_modules" validate constraint "prompt_modules_selection_mode_check";

alter table "public"."publication_issues" add constraint "newsletter_campaigns_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."publication_issues" validate constraint "newsletter_campaigns_newsletter_id_fkey";

alter table "public"."publication_issues" add constraint "newsletter_campaigns_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'processing'::text, 'pending_phase2'::text, 'in_review'::text, 'changes_made'::text, 'ready_to_send'::text, 'sent'::text, 'failed'::text]))) not valid;

alter table "public"."publication_issues" validate constraint "newsletter_campaigns_status_check";

alter table "public"."publication_issues" add constraint "publication_issues_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE SET NULL not valid;

alter table "public"."publication_issues" validate constraint "publication_issues_poll_id_fkey";

alter table "public"."publication_issues" add constraint "publication_issues_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."publication_issues" validate constraint "publication_issues_publication_id_fkey";

alter table "public"."publication_settings" add constraint "newsletter_settings_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."publication_settings" validate constraint "newsletter_settings_newsletter_id_fkey";

alter table "public"."publication_settings" add constraint "newsletter_settings_newsletter_id_key_key" UNIQUE using index "newsletter_settings_newsletter_id_key_key";

alter table "public"."publication_settings" add constraint "newsletter_settings_publication_id_key" UNIQUE using index "newsletter_settings_publication_id_key";

alter table "public"."publications" add constraint "newsletters_slug_key" UNIQUE using index "newsletters_slug_key";

alter table "public"."publications" add constraint "newsletters_subdomain_key" UNIQUE using index "newsletters_subdomain_key";

alter table "public"."rss_feeds" add constraint "rss_feeds_article_module_id_fkey" FOREIGN KEY (article_module_id) REFERENCES public.article_modules(id) ON DELETE SET NULL not valid;

alter table "public"."rss_feeds" validate constraint "rss_feeds_article_module_id_fkey";

alter table "public"."rss_feeds" add constraint "rss_feeds_newsletter_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."rss_feeds" validate constraint "rss_feeds_newsletter_id_fkey";

alter table "public"."rss_posts" add constraint "rss_posts_article_module_id_fkey" FOREIGN KEY (article_module_id) REFERENCES public.article_modules(id) ON DELETE SET NULL not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_article_module_id_fkey";

alter table "public"."rss_posts" add constraint "rss_posts_criteria_1_score_check" CHECK (((criteria_1_score >= 0) AND (criteria_1_score <= 10))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_criteria_1_score_check";

alter table "public"."rss_posts" add constraint "rss_posts_criteria_2_score_check" CHECK (((criteria_2_score >= 0) AND (criteria_2_score <= 10))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_criteria_2_score_check";

alter table "public"."rss_posts" add constraint "rss_posts_criteria_3_score_check" CHECK (((criteria_3_score >= 0) AND (criteria_3_score <= 10))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_criteria_3_score_check";

alter table "public"."rss_posts" add constraint "rss_posts_criteria_4_score_check" CHECK (((criteria_4_score >= 0) AND (criteria_4_score <= 10))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_criteria_4_score_check";

alter table "public"."rss_posts" add constraint "rss_posts_criteria_5_score_check" CHECK (((criteria_5_score >= 0) AND (criteria_5_score <= 10))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_criteria_5_score_check";

alter table "public"."rss_posts" add constraint "rss_posts_criteria_enabled_check" CHECK (((criteria_enabled >= 1) AND (criteria_enabled <= 5))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_criteria_enabled_check";

alter table "public"."rss_posts" add constraint "rss_posts_extraction_status_check" CHECK ((extraction_status = ANY (ARRAY['pending'::text, 'success'::text, 'paywall'::text, 'login_required'::text, 'blocked'::text, 'timeout'::text, 'failed'::text]))) not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_extraction_status_check";

alter table "public"."rss_posts" add constraint "rss_posts_feed_id_fkey" FOREIGN KEY (feed_id) REFERENCES public.rss_feeds(id) ON DELETE CASCADE not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_feed_id_fkey";

alter table "public"."rss_posts" add constraint "rss_posts_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."rss_posts" validate constraint "rss_posts_issue_id_fkey";

alter table "public"."rss_posts" add constraint "unique_external_id" UNIQUE using index "unique_external_id";

alter table "public"."secondary_articles" add constraint "secondary_articles_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."secondary_articles" validate constraint "secondary_articles_issue_id_fkey";

alter table "public"."secondary_articles" add constraint "secondary_articles_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.rss_posts(id) ON DELETE CASCADE not valid;

alter table "public"."secondary_articles" validate constraint "secondary_articles_post_id_fkey";

alter table "public"."sendgrid_field_updates" add constraint "sendgrid_field_updates_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."sendgrid_field_updates" validate constraint "sendgrid_field_updates_status_check";

alter table "public"."sparkloop_daily_snapshots" add constraint "sparkloop_daily_snapshots_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) not valid;

alter table "public"."sparkloop_daily_snapshots" validate constraint "sparkloop_daily_snapshots_publication_id_fkey";

alter table "public"."sparkloop_daily_snapshots" add constraint "sparkloop_daily_snapshots_publication_id_ref_code_snapshot__key" UNIQUE using index "sparkloop_daily_snapshots_publication_id_ref_code_snapshot__key";

alter table "public"."sparkloop_events" add constraint "sparkloop_events_event_type_subscriber_email_event_timestam_key" UNIQUE using index "sparkloop_events_event_type_subscriber_email_event_timestam_key";

alter table "public"."sparkloop_events" add constraint "sparkloop_events_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."sparkloop_events" validate constraint "sparkloop_events_publication_id_fkey";

alter table "public"."sparkloop_module_clicks" add constraint "sparkloop_module_clicks_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."sparkloop_module_clicks" validate constraint "sparkloop_module_clicks_publication_id_fkey";

alter table "public"."sparkloop_rec_modules" add constraint "sparkloop_rec_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."sparkloop_rec_modules" validate constraint "sparkloop_rec_modules_publication_id_fkey";

alter table "public"."sparkloop_rec_modules" add constraint "sparkloop_rec_modules_selection_mode_check" CHECK ((selection_mode = ANY (ARRAY['score_based'::text, 'random'::text, 'sequential'::text, 'manual'::text]))) not valid;

alter table "public"."sparkloop_rec_modules" validate constraint "sparkloop_rec_modules_selection_mode_check";

alter table "public"."sparkloop_recommendations" add constraint "sparkloop_recommendations_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."sparkloop_recommendations" validate constraint "sparkloop_recommendations_publication_id_fkey";

alter table "public"."sparkloop_recommendations" add constraint "sparkloop_recommendations_publication_id_ref_code_key" UNIQUE using index "sparkloop_recommendations_publication_id_ref_code_key";

alter table "public"."sparkloop_referrals" add constraint "sparkloop_referrals_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."sparkloop_referrals" validate constraint "sparkloop_referrals_publication_id_fkey";

alter table "public"."sparkloop_referrals" add constraint "sparkloop_referrals_publication_id_subscriber_email_ref_cod_key" UNIQUE using index "sparkloop_referrals_publication_id_subscriber_email_ref_cod_key";

alter table "public"."subscriber_real_click_status" add constraint "subscriber_real_click_status_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."subscriber_real_click_status" validate constraint "subscriber_real_click_status_publication_id_fkey";

alter table "public"."subscriber_real_click_status" add constraint "subscriber_real_click_status_publication_id_subscriber_emai_key" UNIQUE using index "subscriber_real_click_status_publication_id_subscriber_emai_key";

alter table "public"."text_box_blocks" add constraint "text_box_blocks_block_type_check" CHECK ((block_type = ANY (ARRAY['static_text'::text, 'ai_prompt'::text, 'image'::text]))) not valid;

alter table "public"."text_box_blocks" validate constraint "text_box_blocks_block_type_check";

alter table "public"."text_box_blocks" add constraint "text_box_blocks_generation_timing_check" CHECK ((generation_timing = ANY (ARRAY['before_articles'::text, 'after_articles'::text]))) not valid;

alter table "public"."text_box_blocks" validate constraint "text_box_blocks_generation_timing_check";

alter table "public"."text_box_blocks" add constraint "text_box_blocks_image_type_check" CHECK ((image_type = ANY (ARRAY['static'::text, 'ai_generated'::text]))) not valid;

alter table "public"."text_box_blocks" validate constraint "text_box_blocks_image_type_check";

alter table "public"."text_box_blocks" add constraint "text_box_blocks_text_box_module_id_fkey" FOREIGN KEY (text_box_module_id) REFERENCES public.text_box_modules(id) ON DELETE CASCADE not valid;

alter table "public"."text_box_blocks" validate constraint "text_box_blocks_text_box_module_id_fkey";

alter table "public"."text_box_blocks" add constraint "text_box_blocks_text_size_check" CHECK ((text_size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text]))) not valid;

alter table "public"."text_box_blocks" validate constraint "text_box_blocks_text_size_check";

alter table "public"."text_box_modules" add constraint "text_box_modules_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) ON DELETE CASCADE not valid;

alter table "public"."text_box_modules" validate constraint "text_box_modules_publication_id_fkey";

alter table "public"."tool_directory_clicks" add constraint "tool_directory_clicks_click_type_check" CHECK ((click_type = ANY (ARRAY['category_click'::text, 'tool_view'::text, 'external_link'::text]))) not valid;

alter table "public"."tool_directory_clicks" validate constraint "tool_directory_clicks_click_type_check";

alter table "public"."tool_directory_clicks" add constraint "tool_directory_clicks_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.ai_applications(id) ON DELETE SET NULL not valid;

alter table "public"."tool_directory_clicks" validate constraint "tool_directory_clicks_tool_id_fkey";

alter table "public"."tools_directory" add constraint "tools_directory_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'monthly'::text, 'yearly'::text]))) not valid;

alter table "public"."tools_directory" validate constraint "tools_directory_plan_check";

alter table "public"."tools_directory" add constraint "tools_directory_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES public.publications(id) not valid;

alter table "public"."tools_directory" validate constraint "tools_directory_publication_id_fkey";

alter table "public"."tools_directory" add constraint "tools_directory_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."tools_directory" validate constraint "tools_directory_status_check";

alter table "public"."user_activities" add constraint "user_activities_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.publication_issues(id) ON DELETE CASCADE not valid;

alter table "public"."user_activities" validate constraint "user_activities_issue_id_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_newsletter_by_subdomain(subdomain_input text)
 RETURNS public.publications
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN (SELECT * FROM public.newsletters WHERE subdomain = subdomain_input AND is_active = true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_newsletter_setting(newsletter_id_input uuid, key_input text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN (
    SELECT value
    FROM public.newsletter_settings
    WHERE newsletter_id = newsletter_id_input
    AND key = key_input
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_our_subscribes(p_publication_id uuid, p_ref_codes text[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET our_total_subscribes = our_total_subscribes + 1,
      our_pending = our_pending + 1
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sparkloop_impressions(p_publication_id uuid, p_ref_codes text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET impressions = impressions + 1,
      updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sparkloop_page_impressions(p_publication_id uuid, p_ref_codes text[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET page_impressions = COALESCE(page_impressions, 0) + 1,
      updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sparkloop_page_submissions(p_publication_id uuid, p_ref_codes text[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET page_submissions = COALESCE(page_submissions, 0) + 1,
      updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sparkloop_selections(p_publication_id uuid, p_ref_codes text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET selections = selections + 1,
      updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sparkloop_submissions(p_publication_id uuid, p_ref_codes text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET submissions = submissions + 1,
      pending = pending + 1,
      updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_our_confirm(p_publication_id uuid, p_ref_code text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET our_confirms = our_confirms + 1,
      our_pending = GREATEST(our_pending - 1, 0)
  WHERE publication_id = p_publication_id
    AND ref_code = p_ref_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_our_rejection(p_publication_id uuid, p_ref_code text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET our_rejections = our_rejections + 1,
      our_pending = GREATEST(our_pending - 1, 0)
  WHERE publication_id = p_publication_id
    AND ref_code = p_ref_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_sparkloop_confirm(p_publication_id uuid, p_ref_code text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET 
    confirms = confirms + 1,
    pending = GREATEST(pending - 1, 0),
    updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = p_ref_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_sparkloop_rejection(p_publication_id uuid, p_ref_code text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE sparkloop_recommendations
  SET 
    rejections = rejections + 1,
    pending = GREATEST(pending - 1, 0),
    updated_at = NOW()
  WHERE publication_id = p_publication_id
    AND ref_code = p_ref_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_ai_app_modules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_article_module_criteria_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_article_module_prompts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_article_modules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_directory_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_feedback_blocks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_feedback_modules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_module_articles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_poll_modules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_prompt_modules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_sparkloop_rates()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Calculate CR (Conversion Rate) from POPUP only if we have at least 50 impressions
  IF NEW.impressions >= 50 THEN
    NEW.our_cr := ROUND((NEW.submissions::NUMERIC / NEW.impressions) * 100, 2);
  ELSE
    NEW.our_cr := NULL;
  END IF;

  -- Calculate Page CR if we have at least 50 page impressions
  IF COALESCE(NEW.page_impressions, 0) >= 50 THEN
    NEW.page_cr := ROUND((COALESCE(NEW.page_submissions, 0)::NUMERIC / NEW.page_impressions) * 100, 2);
  ELSE
    NEW.page_cr := NULL;
  END IF;

  -- Calculate RCR from OUR confirms/rejections (not SparkLoop's)
  IF (NEW.our_confirms + NEW.our_rejections) >= 20 THEN
    NEW.our_rcr := ROUND((NEW.our_confirms::NUMERIC / (NEW.our_confirms + NEW.our_rejections)) * 100, 2);
  ELSE
    NEW.our_rcr := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_sparkloop_rcr()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only calculate our_rcr if we have at least 20 total outcomes
  IF (NEW.confirms + NEW.rejections) >= 20 THEN
    NEW.our_rcr := ROUND((NEW.confirms::NUMERIC / (NEW.confirms + NEW.rejections)) * 100, 2);
  ELSE
    NEW.our_rcr := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_text_box_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."ad_block_types" to "anon";

grant insert on table "public"."ad_block_types" to "anon";

grant references on table "public"."ad_block_types" to "anon";

grant select on table "public"."ad_block_types" to "anon";

grant trigger on table "public"."ad_block_types" to "anon";

grant truncate on table "public"."ad_block_types" to "anon";

grant update on table "public"."ad_block_types" to "anon";

grant delete on table "public"."ad_block_types" to "authenticated";

grant insert on table "public"."ad_block_types" to "authenticated";

grant references on table "public"."ad_block_types" to "authenticated";

grant select on table "public"."ad_block_types" to "authenticated";

grant trigger on table "public"."ad_block_types" to "authenticated";

grant truncate on table "public"."ad_block_types" to "authenticated";

grant update on table "public"."ad_block_types" to "authenticated";

grant delete on table "public"."ad_block_types" to "service_role";

grant insert on table "public"."ad_block_types" to "service_role";

grant references on table "public"."ad_block_types" to "service_role";

grant select on table "public"."ad_block_types" to "service_role";

grant trigger on table "public"."ad_block_types" to "service_role";

grant truncate on table "public"."ad_block_types" to "service_role";

grant update on table "public"."ad_block_types" to "service_role";

grant delete on table "public"."ad_module_advertisers" to "anon";

grant insert on table "public"."ad_module_advertisers" to "anon";

grant references on table "public"."ad_module_advertisers" to "anon";

grant select on table "public"."ad_module_advertisers" to "anon";

grant trigger on table "public"."ad_module_advertisers" to "anon";

grant truncate on table "public"."ad_module_advertisers" to "anon";

grant update on table "public"."ad_module_advertisers" to "anon";

grant delete on table "public"."ad_module_advertisers" to "authenticated";

grant insert on table "public"."ad_module_advertisers" to "authenticated";

grant references on table "public"."ad_module_advertisers" to "authenticated";

grant select on table "public"."ad_module_advertisers" to "authenticated";

grant trigger on table "public"."ad_module_advertisers" to "authenticated";

grant truncate on table "public"."ad_module_advertisers" to "authenticated";

grant update on table "public"."ad_module_advertisers" to "authenticated";

grant delete on table "public"."ad_module_advertisers" to "service_role";

grant insert on table "public"."ad_module_advertisers" to "service_role";

grant references on table "public"."ad_module_advertisers" to "service_role";

grant select on table "public"."ad_module_advertisers" to "service_role";

grant trigger on table "public"."ad_module_advertisers" to "service_role";

grant truncate on table "public"."ad_module_advertisers" to "service_role";

grant update on table "public"."ad_module_advertisers" to "service_role";

grant delete on table "public"."ad_modules" to "anon";

grant insert on table "public"."ad_modules" to "anon";

grant references on table "public"."ad_modules" to "anon";

grant select on table "public"."ad_modules" to "anon";

grant trigger on table "public"."ad_modules" to "anon";

grant truncate on table "public"."ad_modules" to "anon";

grant update on table "public"."ad_modules" to "anon";

grant delete on table "public"."ad_modules" to "authenticated";

grant insert on table "public"."ad_modules" to "authenticated";

grant references on table "public"."ad_modules" to "authenticated";

grant select on table "public"."ad_modules" to "authenticated";

grant trigger on table "public"."ad_modules" to "authenticated";

grant truncate on table "public"."ad_modules" to "authenticated";

grant update on table "public"."ad_modules" to "authenticated";

grant delete on table "public"."ad_modules" to "service_role";

grant insert on table "public"."ad_modules" to "service_role";

grant references on table "public"."ad_modules" to "service_role";

grant select on table "public"."ad_modules" to "service_role";

grant trigger on table "public"."ad_modules" to "service_role";

grant truncate on table "public"."ad_modules" to "service_role";

grant update on table "public"."ad_modules" to "service_role";

grant delete on table "public"."ad_pricing_tiers" to "anon";

grant insert on table "public"."ad_pricing_tiers" to "anon";

grant references on table "public"."ad_pricing_tiers" to "anon";

grant select on table "public"."ad_pricing_tiers" to "anon";

grant trigger on table "public"."ad_pricing_tiers" to "anon";

grant truncate on table "public"."ad_pricing_tiers" to "anon";

grant update on table "public"."ad_pricing_tiers" to "anon";

grant delete on table "public"."ad_pricing_tiers" to "authenticated";

grant insert on table "public"."ad_pricing_tiers" to "authenticated";

grant references on table "public"."ad_pricing_tiers" to "authenticated";

grant select on table "public"."ad_pricing_tiers" to "authenticated";

grant trigger on table "public"."ad_pricing_tiers" to "authenticated";

grant truncate on table "public"."ad_pricing_tiers" to "authenticated";

grant update on table "public"."ad_pricing_tiers" to "authenticated";

grant delete on table "public"."ad_pricing_tiers" to "service_role";

grant insert on table "public"."ad_pricing_tiers" to "service_role";

grant references on table "public"."ad_pricing_tiers" to "service_role";

grant select on table "public"."ad_pricing_tiers" to "service_role";

grant trigger on table "public"."ad_pricing_tiers" to "service_role";

grant truncate on table "public"."ad_pricing_tiers" to "service_role";

grant update on table "public"."ad_pricing_tiers" to "service_role";

grant delete on table "public"."advertisements" to "anon";

grant insert on table "public"."advertisements" to "anon";

grant references on table "public"."advertisements" to "anon";

grant select on table "public"."advertisements" to "anon";

grant trigger on table "public"."advertisements" to "anon";

grant truncate on table "public"."advertisements" to "anon";

grant update on table "public"."advertisements" to "anon";

grant delete on table "public"."advertisements" to "authenticated";

grant insert on table "public"."advertisements" to "authenticated";

grant references on table "public"."advertisements" to "authenticated";

grant select on table "public"."advertisements" to "authenticated";

grant trigger on table "public"."advertisements" to "authenticated";

grant truncate on table "public"."advertisements" to "authenticated";

grant update on table "public"."advertisements" to "authenticated";

grant delete on table "public"."advertisements" to "service_role";

grant insert on table "public"."advertisements" to "service_role";

grant references on table "public"."advertisements" to "service_role";

grant select on table "public"."advertisements" to "service_role";

grant trigger on table "public"."advertisements" to "service_role";

grant truncate on table "public"."advertisements" to "service_role";

grant update on table "public"."advertisements" to "service_role";

grant delete on table "public"."advertisers" to "anon";

grant insert on table "public"."advertisers" to "anon";

grant references on table "public"."advertisers" to "anon";

grant select on table "public"."advertisers" to "anon";

grant trigger on table "public"."advertisers" to "anon";

grant truncate on table "public"."advertisers" to "anon";

grant update on table "public"."advertisers" to "anon";

grant delete on table "public"."advertisers" to "authenticated";

grant insert on table "public"."advertisers" to "authenticated";

grant references on table "public"."advertisers" to "authenticated";

grant select on table "public"."advertisers" to "authenticated";

grant trigger on table "public"."advertisers" to "authenticated";

grant truncate on table "public"."advertisers" to "authenticated";

grant update on table "public"."advertisers" to "authenticated";

grant delete on table "public"."advertisers" to "service_role";

grant insert on table "public"."advertisers" to "service_role";

grant references on table "public"."advertisers" to "service_role";

grant select on table "public"."advertisers" to "service_role";

grant trigger on table "public"."advertisers" to "service_role";

grant truncate on table "public"."advertisers" to "service_role";

grant update on table "public"."advertisers" to "service_role";

grant delete on table "public"."ai_app_block_types" to "anon";

grant insert on table "public"."ai_app_block_types" to "anon";

grant references on table "public"."ai_app_block_types" to "anon";

grant select on table "public"."ai_app_block_types" to "anon";

grant trigger on table "public"."ai_app_block_types" to "anon";

grant truncate on table "public"."ai_app_block_types" to "anon";

grant update on table "public"."ai_app_block_types" to "anon";

grant delete on table "public"."ai_app_block_types" to "authenticated";

grant insert on table "public"."ai_app_block_types" to "authenticated";

grant references on table "public"."ai_app_block_types" to "authenticated";

grant select on table "public"."ai_app_block_types" to "authenticated";

grant trigger on table "public"."ai_app_block_types" to "authenticated";

grant truncate on table "public"."ai_app_block_types" to "authenticated";

grant update on table "public"."ai_app_block_types" to "authenticated";

grant delete on table "public"."ai_app_block_types" to "service_role";

grant insert on table "public"."ai_app_block_types" to "service_role";

grant references on table "public"."ai_app_block_types" to "service_role";

grant select on table "public"."ai_app_block_types" to "service_role";

grant trigger on table "public"."ai_app_block_types" to "service_role";

grant truncate on table "public"."ai_app_block_types" to "service_role";

grant update on table "public"."ai_app_block_types" to "service_role";

grant delete on table "public"."ai_app_modules" to "anon";

grant insert on table "public"."ai_app_modules" to "anon";

grant references on table "public"."ai_app_modules" to "anon";

grant select on table "public"."ai_app_modules" to "anon";

grant trigger on table "public"."ai_app_modules" to "anon";

grant truncate on table "public"."ai_app_modules" to "anon";

grant update on table "public"."ai_app_modules" to "anon";

grant delete on table "public"."ai_app_modules" to "authenticated";

grant insert on table "public"."ai_app_modules" to "authenticated";

grant references on table "public"."ai_app_modules" to "authenticated";

grant select on table "public"."ai_app_modules" to "authenticated";

grant trigger on table "public"."ai_app_modules" to "authenticated";

grant truncate on table "public"."ai_app_modules" to "authenticated";

grant update on table "public"."ai_app_modules" to "authenticated";

grant delete on table "public"."ai_app_modules" to "service_role";

grant insert on table "public"."ai_app_modules" to "service_role";

grant references on table "public"."ai_app_modules" to "service_role";

grant select on table "public"."ai_app_modules" to "service_role";

grant trigger on table "public"."ai_app_modules" to "service_role";

grant truncate on table "public"."ai_app_modules" to "service_role";

grant update on table "public"."ai_app_modules" to "service_role";

grant delete on table "public"."ai_applications" to "anon";

grant insert on table "public"."ai_applications" to "anon";

grant references on table "public"."ai_applications" to "anon";

grant select on table "public"."ai_applications" to "anon";

grant trigger on table "public"."ai_applications" to "anon";

grant truncate on table "public"."ai_applications" to "anon";

grant update on table "public"."ai_applications" to "anon";

grant delete on table "public"."ai_applications" to "authenticated";

grant insert on table "public"."ai_applications" to "authenticated";

grant references on table "public"."ai_applications" to "authenticated";

grant select on table "public"."ai_applications" to "authenticated";

grant trigger on table "public"."ai_applications" to "authenticated";

grant truncate on table "public"."ai_applications" to "authenticated";

grant update on table "public"."ai_applications" to "authenticated";

grant delete on table "public"."ai_applications" to "service_role";

grant insert on table "public"."ai_applications" to "service_role";

grant references on table "public"."ai_applications" to "service_role";

grant select on table "public"."ai_applications" to "service_role";

grant trigger on table "public"."ai_applications" to "service_role";

grant truncate on table "public"."ai_applications" to "service_role";

grant update on table "public"."ai_applications" to "service_role";

grant delete on table "public"."ai_prompt_tests" to "anon";

grant insert on table "public"."ai_prompt_tests" to "anon";

grant references on table "public"."ai_prompt_tests" to "anon";

grant select on table "public"."ai_prompt_tests" to "anon";

grant trigger on table "public"."ai_prompt_tests" to "anon";

grant truncate on table "public"."ai_prompt_tests" to "anon";

grant update on table "public"."ai_prompt_tests" to "anon";

grant delete on table "public"."ai_prompt_tests" to "authenticated";

grant insert on table "public"."ai_prompt_tests" to "authenticated";

grant references on table "public"."ai_prompt_tests" to "authenticated";

grant select on table "public"."ai_prompt_tests" to "authenticated";

grant trigger on table "public"."ai_prompt_tests" to "authenticated";

grant truncate on table "public"."ai_prompt_tests" to "authenticated";

grant update on table "public"."ai_prompt_tests" to "authenticated";

grant delete on table "public"."ai_prompt_tests" to "service_role";

grant insert on table "public"."ai_prompt_tests" to "service_role";

grant references on table "public"."ai_prompt_tests" to "service_role";

grant select on table "public"."ai_prompt_tests" to "service_role";

grant trigger on table "public"."ai_prompt_tests" to "service_role";

grant truncate on table "public"."ai_prompt_tests" to "service_role";

grant update on table "public"."ai_prompt_tests" to "service_role";

grant delete on table "public"."app_settings" to "anon";

grant insert on table "public"."app_settings" to "anon";

grant references on table "public"."app_settings" to "anon";

grant select on table "public"."app_settings" to "anon";

grant trigger on table "public"."app_settings" to "anon";

grant truncate on table "public"."app_settings" to "anon";

grant update on table "public"."app_settings" to "anon";

grant delete on table "public"."app_settings" to "authenticated";

grant insert on table "public"."app_settings" to "authenticated";

grant references on table "public"."app_settings" to "authenticated";

grant select on table "public"."app_settings" to "authenticated";

grant trigger on table "public"."app_settings" to "authenticated";

grant truncate on table "public"."app_settings" to "authenticated";

grant update on table "public"."app_settings" to "authenticated";

grant delete on table "public"."app_settings" to "service_role";

grant insert on table "public"."app_settings" to "service_role";

grant references on table "public"."app_settings" to "service_role";

grant select on table "public"."app_settings" to "service_role";

grant trigger on table "public"."app_settings" to "service_role";

grant truncate on table "public"."app_settings" to "service_role";

grant update on table "public"."app_settings" to "service_role";

grant delete on table "public"."archived_articles" to "anon";

grant insert on table "public"."archived_articles" to "anon";

grant references on table "public"."archived_articles" to "anon";

grant select on table "public"."archived_articles" to "anon";

grant trigger on table "public"."archived_articles" to "anon";

grant truncate on table "public"."archived_articles" to "anon";

grant update on table "public"."archived_articles" to "anon";

grant delete on table "public"."archived_articles" to "authenticated";

grant insert on table "public"."archived_articles" to "authenticated";

grant references on table "public"."archived_articles" to "authenticated";

grant select on table "public"."archived_articles" to "authenticated";

grant trigger on table "public"."archived_articles" to "authenticated";

grant truncate on table "public"."archived_articles" to "authenticated";

grant update on table "public"."archived_articles" to "authenticated";

grant delete on table "public"."archived_articles" to "service_role";

grant insert on table "public"."archived_articles" to "service_role";

grant references on table "public"."archived_articles" to "service_role";

grant select on table "public"."archived_articles" to "service_role";

grant trigger on table "public"."archived_articles" to "service_role";

grant truncate on table "public"."archived_articles" to "service_role";

grant update on table "public"."archived_articles" to "service_role";

grant delete on table "public"."archived_newsletters" to "anon";

grant insert on table "public"."archived_newsletters" to "anon";

grant references on table "public"."archived_newsletters" to "anon";

grant select on table "public"."archived_newsletters" to "anon";

grant trigger on table "public"."archived_newsletters" to "anon";

grant truncate on table "public"."archived_newsletters" to "anon";

grant update on table "public"."archived_newsletters" to "anon";

grant delete on table "public"."archived_newsletters" to "authenticated";

grant insert on table "public"."archived_newsletters" to "authenticated";

grant references on table "public"."archived_newsletters" to "authenticated";

grant select on table "public"."archived_newsletters" to "authenticated";

grant trigger on table "public"."archived_newsletters" to "authenticated";

grant truncate on table "public"."archived_newsletters" to "authenticated";

grant update on table "public"."archived_newsletters" to "authenticated";

grant delete on table "public"."archived_newsletters" to "service_role";

grant insert on table "public"."archived_newsletters" to "service_role";

grant references on table "public"."archived_newsletters" to "service_role";

grant select on table "public"."archived_newsletters" to "service_role";

grant trigger on table "public"."archived_newsletters" to "service_role";

grant truncate on table "public"."archived_newsletters" to "service_role";

grant update on table "public"."archived_newsletters" to "service_role";

grant delete on table "public"."archived_post_ratings" to "anon";

grant insert on table "public"."archived_post_ratings" to "anon";

grant references on table "public"."archived_post_ratings" to "anon";

grant select on table "public"."archived_post_ratings" to "anon";

grant trigger on table "public"."archived_post_ratings" to "anon";

grant truncate on table "public"."archived_post_ratings" to "anon";

grant update on table "public"."archived_post_ratings" to "anon";

grant delete on table "public"."archived_post_ratings" to "authenticated";

grant insert on table "public"."archived_post_ratings" to "authenticated";

grant references on table "public"."archived_post_ratings" to "authenticated";

grant select on table "public"."archived_post_ratings" to "authenticated";

grant trigger on table "public"."archived_post_ratings" to "authenticated";

grant truncate on table "public"."archived_post_ratings" to "authenticated";

grant update on table "public"."archived_post_ratings" to "authenticated";

grant delete on table "public"."archived_post_ratings" to "service_role";

grant insert on table "public"."archived_post_ratings" to "service_role";

grant references on table "public"."archived_post_ratings" to "service_role";

grant select on table "public"."archived_post_ratings" to "service_role";

grant trigger on table "public"."archived_post_ratings" to "service_role";

grant truncate on table "public"."archived_post_ratings" to "service_role";

grant update on table "public"."archived_post_ratings" to "service_role";

grant delete on table "public"."archived_rss_posts" to "anon";

grant insert on table "public"."archived_rss_posts" to "anon";

grant references on table "public"."archived_rss_posts" to "anon";

grant select on table "public"."archived_rss_posts" to "anon";

grant trigger on table "public"."archived_rss_posts" to "anon";

grant truncate on table "public"."archived_rss_posts" to "anon";

grant update on table "public"."archived_rss_posts" to "anon";

grant delete on table "public"."archived_rss_posts" to "authenticated";

grant insert on table "public"."archived_rss_posts" to "authenticated";

grant references on table "public"."archived_rss_posts" to "authenticated";

grant select on table "public"."archived_rss_posts" to "authenticated";

grant trigger on table "public"."archived_rss_posts" to "authenticated";

grant truncate on table "public"."archived_rss_posts" to "authenticated";

grant update on table "public"."archived_rss_posts" to "authenticated";

grant delete on table "public"."archived_rss_posts" to "service_role";

grant insert on table "public"."archived_rss_posts" to "service_role";

grant references on table "public"."archived_rss_posts" to "service_role";

grant select on table "public"."archived_rss_posts" to "service_role";

grant trigger on table "public"."archived_rss_posts" to "service_role";

grant truncate on table "public"."archived_rss_posts" to "service_role";

grant update on table "public"."archived_rss_posts" to "service_role";

grant delete on table "public"."archived_secondary_articles" to "anon";

grant insert on table "public"."archived_secondary_articles" to "anon";

grant references on table "public"."archived_secondary_articles" to "anon";

grant select on table "public"."archived_secondary_articles" to "anon";

grant trigger on table "public"."archived_secondary_articles" to "anon";

grant truncate on table "public"."archived_secondary_articles" to "anon";

grant update on table "public"."archived_secondary_articles" to "anon";

grant delete on table "public"."archived_secondary_articles" to "authenticated";

grant insert on table "public"."archived_secondary_articles" to "authenticated";

grant references on table "public"."archived_secondary_articles" to "authenticated";

grant select on table "public"."archived_secondary_articles" to "authenticated";

grant trigger on table "public"."archived_secondary_articles" to "authenticated";

grant truncate on table "public"."archived_secondary_articles" to "authenticated";

grant update on table "public"."archived_secondary_articles" to "authenticated";

grant delete on table "public"."archived_secondary_articles" to "service_role";

grant insert on table "public"."archived_secondary_articles" to "service_role";

grant references on table "public"."archived_secondary_articles" to "service_role";

grant select on table "public"."archived_secondary_articles" to "service_role";

grant trigger on table "public"."archived_secondary_articles" to "service_role";

grant truncate on table "public"."archived_secondary_articles" to "service_role";

grant update on table "public"."archived_secondary_articles" to "service_role";

grant delete on table "public"."article_categories" to "anon";

grant insert on table "public"."article_categories" to "anon";

grant references on table "public"."article_categories" to "anon";

grant select on table "public"."article_categories" to "anon";

grant trigger on table "public"."article_categories" to "anon";

grant truncate on table "public"."article_categories" to "anon";

grant update on table "public"."article_categories" to "anon";

grant delete on table "public"."article_categories" to "authenticated";

grant insert on table "public"."article_categories" to "authenticated";

grant references on table "public"."article_categories" to "authenticated";

grant select on table "public"."article_categories" to "authenticated";

grant trigger on table "public"."article_categories" to "authenticated";

grant truncate on table "public"."article_categories" to "authenticated";

grant update on table "public"."article_categories" to "authenticated";

grant delete on table "public"."article_categories" to "service_role";

grant insert on table "public"."article_categories" to "service_role";

grant references on table "public"."article_categories" to "service_role";

grant select on table "public"."article_categories" to "service_role";

grant trigger on table "public"."article_categories" to "service_role";

grant truncate on table "public"."article_categories" to "service_role";

grant update on table "public"."article_categories" to "service_role";

grant delete on table "public"."article_module_criteria" to "anon";

grant insert on table "public"."article_module_criteria" to "anon";

grant references on table "public"."article_module_criteria" to "anon";

grant select on table "public"."article_module_criteria" to "anon";

grant trigger on table "public"."article_module_criteria" to "anon";

grant truncate on table "public"."article_module_criteria" to "anon";

grant update on table "public"."article_module_criteria" to "anon";

grant delete on table "public"."article_module_criteria" to "authenticated";

grant insert on table "public"."article_module_criteria" to "authenticated";

grant references on table "public"."article_module_criteria" to "authenticated";

grant select on table "public"."article_module_criteria" to "authenticated";

grant trigger on table "public"."article_module_criteria" to "authenticated";

grant truncate on table "public"."article_module_criteria" to "authenticated";

grant update on table "public"."article_module_criteria" to "authenticated";

grant delete on table "public"."article_module_criteria" to "service_role";

grant insert on table "public"."article_module_criteria" to "service_role";

grant references on table "public"."article_module_criteria" to "service_role";

grant select on table "public"."article_module_criteria" to "service_role";

grant trigger on table "public"."article_module_criteria" to "service_role";

grant truncate on table "public"."article_module_criteria" to "service_role";

grant update on table "public"."article_module_criteria" to "service_role";

grant delete on table "public"."article_module_prompts" to "anon";

grant insert on table "public"."article_module_prompts" to "anon";

grant references on table "public"."article_module_prompts" to "anon";

grant select on table "public"."article_module_prompts" to "anon";

grant trigger on table "public"."article_module_prompts" to "anon";

grant truncate on table "public"."article_module_prompts" to "anon";

grant update on table "public"."article_module_prompts" to "anon";

grant delete on table "public"."article_module_prompts" to "authenticated";

grant insert on table "public"."article_module_prompts" to "authenticated";

grant references on table "public"."article_module_prompts" to "authenticated";

grant select on table "public"."article_module_prompts" to "authenticated";

grant trigger on table "public"."article_module_prompts" to "authenticated";

grant truncate on table "public"."article_module_prompts" to "authenticated";

grant update on table "public"."article_module_prompts" to "authenticated";

grant delete on table "public"."article_module_prompts" to "service_role";

grant insert on table "public"."article_module_prompts" to "service_role";

grant references on table "public"."article_module_prompts" to "service_role";

grant select on table "public"."article_module_prompts" to "service_role";

grant trigger on table "public"."article_module_prompts" to "service_role";

grant truncate on table "public"."article_module_prompts" to "service_role";

grant update on table "public"."article_module_prompts" to "service_role";

grant delete on table "public"."article_modules" to "anon";

grant insert on table "public"."article_modules" to "anon";

grant references on table "public"."article_modules" to "anon";

grant select on table "public"."article_modules" to "anon";

grant trigger on table "public"."article_modules" to "anon";

grant truncate on table "public"."article_modules" to "anon";

grant update on table "public"."article_modules" to "anon";

grant delete on table "public"."article_modules" to "authenticated";

grant insert on table "public"."article_modules" to "authenticated";

grant references on table "public"."article_modules" to "authenticated";

grant select on table "public"."article_modules" to "authenticated";

grant trigger on table "public"."article_modules" to "authenticated";

grant truncate on table "public"."article_modules" to "authenticated";

grant update on table "public"."article_modules" to "authenticated";

grant delete on table "public"."article_modules" to "service_role";

grant insert on table "public"."article_modules" to "service_role";

grant references on table "public"."article_modules" to "service_role";

grant select on table "public"."article_modules" to "service_role";

grant trigger on table "public"."article_modules" to "service_role";

grant truncate on table "public"."article_modules" to "service_role";

grant update on table "public"."article_modules" to "service_role";

grant delete on table "public"."articles" to "anon";

grant insert on table "public"."articles" to "anon";

grant references on table "public"."articles" to "anon";

grant select on table "public"."articles" to "anon";

grant trigger on table "public"."articles" to "anon";

grant truncate on table "public"."articles" to "anon";

grant update on table "public"."articles" to "anon";

grant delete on table "public"."articles" to "authenticated";

grant insert on table "public"."articles" to "authenticated";

grant references on table "public"."articles" to "authenticated";

grant select on table "public"."articles" to "authenticated";

grant trigger on table "public"."articles" to "authenticated";

grant truncate on table "public"."articles" to "authenticated";

grant update on table "public"."articles" to "authenticated";

grant delete on table "public"."articles" to "service_role";

grant insert on table "public"."articles" to "service_role";

grant references on table "public"."articles" to "service_role";

grant select on table "public"."articles" to "service_role";

grant trigger on table "public"."articles" to "service_role";

grant truncate on table "public"."articles" to "service_role";

grant update on table "public"."articles" to "service_role";

grant delete on table "public"."contact_submissions" to "anon";

grant insert on table "public"."contact_submissions" to "anon";

grant references on table "public"."contact_submissions" to "anon";

grant select on table "public"."contact_submissions" to "anon";

grant trigger on table "public"."contact_submissions" to "anon";

grant truncate on table "public"."contact_submissions" to "anon";

grant update on table "public"."contact_submissions" to "anon";

grant delete on table "public"."contact_submissions" to "authenticated";

grant insert on table "public"."contact_submissions" to "authenticated";

grant references on table "public"."contact_submissions" to "authenticated";

grant select on table "public"."contact_submissions" to "authenticated";

grant trigger on table "public"."contact_submissions" to "authenticated";

grant truncate on table "public"."contact_submissions" to "authenticated";

grant update on table "public"."contact_submissions" to "authenticated";

grant delete on table "public"."contact_submissions" to "service_role";

grant insert on table "public"."contact_submissions" to "service_role";

grant references on table "public"."contact_submissions" to "service_role";

grant select on table "public"."contact_submissions" to "service_role";

grant trigger on table "public"."contact_submissions" to "service_role";

grant truncate on table "public"."contact_submissions" to "service_role";

grant update on table "public"."contact_submissions" to "service_role";

grant delete on table "public"."directory_categories" to "anon";

grant insert on table "public"."directory_categories" to "anon";

grant references on table "public"."directory_categories" to "anon";

grant select on table "public"."directory_categories" to "anon";

grant trigger on table "public"."directory_categories" to "anon";

grant truncate on table "public"."directory_categories" to "anon";

grant update on table "public"."directory_categories" to "anon";

grant delete on table "public"."directory_categories" to "authenticated";

grant insert on table "public"."directory_categories" to "authenticated";

grant references on table "public"."directory_categories" to "authenticated";

grant select on table "public"."directory_categories" to "authenticated";

grant trigger on table "public"."directory_categories" to "authenticated";

grant truncate on table "public"."directory_categories" to "authenticated";

grant update on table "public"."directory_categories" to "authenticated";

grant delete on table "public"."directory_categories" to "service_role";

grant insert on table "public"."directory_categories" to "service_role";

grant references on table "public"."directory_categories" to "service_role";

grant select on table "public"."directory_categories" to "service_role";

grant trigger on table "public"."directory_categories" to "service_role";

grant truncate on table "public"."directory_categories" to "service_role";

grant update on table "public"."directory_categories" to "service_role";

grant delete on table "public"."directory_categories_tools" to "anon";

grant insert on table "public"."directory_categories_tools" to "anon";

grant references on table "public"."directory_categories_tools" to "anon";

grant select on table "public"."directory_categories_tools" to "anon";

grant trigger on table "public"."directory_categories_tools" to "anon";

grant truncate on table "public"."directory_categories_tools" to "anon";

grant update on table "public"."directory_categories_tools" to "anon";

grant delete on table "public"."directory_categories_tools" to "authenticated";

grant insert on table "public"."directory_categories_tools" to "authenticated";

grant references on table "public"."directory_categories_tools" to "authenticated";

grant select on table "public"."directory_categories_tools" to "authenticated";

grant trigger on table "public"."directory_categories_tools" to "authenticated";

grant truncate on table "public"."directory_categories_tools" to "authenticated";

grant update on table "public"."directory_categories_tools" to "authenticated";

grant delete on table "public"."directory_categories_tools" to "service_role";

grant insert on table "public"."directory_categories_tools" to "service_role";

grant references on table "public"."directory_categories_tools" to "service_role";

grant select on table "public"."directory_categories_tools" to "service_role";

grant trigger on table "public"."directory_categories_tools" to "service_role";

grant truncate on table "public"."directory_categories_tools" to "service_role";

grant update on table "public"."directory_categories_tools" to "service_role";

grant delete on table "public"."duplicate_groups" to "anon";

grant insert on table "public"."duplicate_groups" to "anon";

grant references on table "public"."duplicate_groups" to "anon";

grant select on table "public"."duplicate_groups" to "anon";

grant trigger on table "public"."duplicate_groups" to "anon";

grant truncate on table "public"."duplicate_groups" to "anon";

grant update on table "public"."duplicate_groups" to "anon";

grant delete on table "public"."duplicate_groups" to "authenticated";

grant insert on table "public"."duplicate_groups" to "authenticated";

grant references on table "public"."duplicate_groups" to "authenticated";

grant select on table "public"."duplicate_groups" to "authenticated";

grant trigger on table "public"."duplicate_groups" to "authenticated";

grant truncate on table "public"."duplicate_groups" to "authenticated";

grant update on table "public"."duplicate_groups" to "authenticated";

grant delete on table "public"."duplicate_groups" to "service_role";

grant insert on table "public"."duplicate_groups" to "service_role";

grant references on table "public"."duplicate_groups" to "service_role";

grant select on table "public"."duplicate_groups" to "service_role";

grant trigger on table "public"."duplicate_groups" to "service_role";

grant truncate on table "public"."duplicate_groups" to "service_role";

grant update on table "public"."duplicate_groups" to "service_role";

grant delete on table "public"."duplicate_posts" to "anon";

grant insert on table "public"."duplicate_posts" to "anon";

grant references on table "public"."duplicate_posts" to "anon";

grant select on table "public"."duplicate_posts" to "anon";

grant trigger on table "public"."duplicate_posts" to "anon";

grant truncate on table "public"."duplicate_posts" to "anon";

grant update on table "public"."duplicate_posts" to "anon";

grant delete on table "public"."duplicate_posts" to "authenticated";

grant insert on table "public"."duplicate_posts" to "authenticated";

grant references on table "public"."duplicate_posts" to "authenticated";

grant select on table "public"."duplicate_posts" to "authenticated";

grant trigger on table "public"."duplicate_posts" to "authenticated";

grant truncate on table "public"."duplicate_posts" to "authenticated";

grant update on table "public"."duplicate_posts" to "authenticated";

grant delete on table "public"."duplicate_posts" to "service_role";

grant insert on table "public"."duplicate_posts" to "service_role";

grant references on table "public"."duplicate_posts" to "service_role";

grant select on table "public"."duplicate_posts" to "service_role";

grant trigger on table "public"."duplicate_posts" to "service_role";

grant truncate on table "public"."duplicate_posts" to "service_role";

grant update on table "public"."duplicate_posts" to "service_role";

grant delete on table "public"."email_metrics" to "anon";

grant insert on table "public"."email_metrics" to "anon";

grant references on table "public"."email_metrics" to "anon";

grant select on table "public"."email_metrics" to "anon";

grant trigger on table "public"."email_metrics" to "anon";

grant truncate on table "public"."email_metrics" to "anon";

grant update on table "public"."email_metrics" to "anon";

grant delete on table "public"."email_metrics" to "authenticated";

grant insert on table "public"."email_metrics" to "authenticated";

grant references on table "public"."email_metrics" to "authenticated";

grant select on table "public"."email_metrics" to "authenticated";

grant trigger on table "public"."email_metrics" to "authenticated";

grant truncate on table "public"."email_metrics" to "authenticated";

grant update on table "public"."email_metrics" to "authenticated";

grant delete on table "public"."email_metrics" to "service_role";

grant insert on table "public"."email_metrics" to "service_role";

grant references on table "public"."email_metrics" to "service_role";

grant select on table "public"."email_metrics" to "service_role";

grant trigger on table "public"."email_metrics" to "service_role";

grant truncate on table "public"."email_metrics" to "service_role";

grant update on table "public"."email_metrics" to "service_role";

grant delete on table "public"."event_venues" to "anon";

grant insert on table "public"."event_venues" to "anon";

grant references on table "public"."event_venues" to "anon";

grant select on table "public"."event_venues" to "anon";

grant trigger on table "public"."event_venues" to "anon";

grant truncate on table "public"."event_venues" to "anon";

grant update on table "public"."event_venues" to "anon";

grant delete on table "public"."event_venues" to "authenticated";

grant insert on table "public"."event_venues" to "authenticated";

grant references on table "public"."event_venues" to "authenticated";

grant select on table "public"."event_venues" to "authenticated";

grant trigger on table "public"."event_venues" to "authenticated";

grant truncate on table "public"."event_venues" to "authenticated";

grant update on table "public"."event_venues" to "authenticated";

grant delete on table "public"."event_venues" to "service_role";

grant insert on table "public"."event_venues" to "service_role";

grant references on table "public"."event_venues" to "service_role";

grant select on table "public"."event_venues" to "service_role";

grant trigger on table "public"."event_venues" to "service_role";

grant truncate on table "public"."event_venues" to "service_role";

grant update on table "public"."event_venues" to "service_role";

grant delete on table "public"."events" to "anon";

grant insert on table "public"."events" to "anon";

grant references on table "public"."events" to "anon";

grant select on table "public"."events" to "anon";

grant trigger on table "public"."events" to "anon";

grant truncate on table "public"."events" to "anon";

grant update on table "public"."events" to "anon";

grant delete on table "public"."events" to "authenticated";

grant insert on table "public"."events" to "authenticated";

grant references on table "public"."events" to "authenticated";

grant select on table "public"."events" to "authenticated";

grant trigger on table "public"."events" to "authenticated";

grant truncate on table "public"."events" to "authenticated";

grant update on table "public"."events" to "authenticated";

grant delete on table "public"."events" to "service_role";

grant insert on table "public"."events" to "service_role";

grant references on table "public"."events" to "service_role";

grant select on table "public"."events" to "service_role";

grant trigger on table "public"."events" to "service_role";

grant truncate on table "public"."events" to "service_role";

grant update on table "public"."events" to "service_role";

grant delete on table "public"."excluded_ips" to "anon";

grant insert on table "public"."excluded_ips" to "anon";

grant references on table "public"."excluded_ips" to "anon";

grant select on table "public"."excluded_ips" to "anon";

grant trigger on table "public"."excluded_ips" to "anon";

grant truncate on table "public"."excluded_ips" to "anon";

grant update on table "public"."excluded_ips" to "anon";

grant delete on table "public"."excluded_ips" to "authenticated";

grant insert on table "public"."excluded_ips" to "authenticated";

grant references on table "public"."excluded_ips" to "authenticated";

grant select on table "public"."excluded_ips" to "authenticated";

grant trigger on table "public"."excluded_ips" to "authenticated";

grant truncate on table "public"."excluded_ips" to "authenticated";

grant update on table "public"."excluded_ips" to "authenticated";

grant delete on table "public"."excluded_ips" to "service_role";

grant insert on table "public"."excluded_ips" to "service_role";

grant references on table "public"."excluded_ips" to "service_role";

grant select on table "public"."excluded_ips" to "service_role";

grant trigger on table "public"."excluded_ips" to "service_role";

grant truncate on table "public"."excluded_ips" to "service_role";

grant update on table "public"."excluded_ips" to "service_role";

grant delete on table "public"."feedback_blocks" to "anon";

grant insert on table "public"."feedback_blocks" to "anon";

grant references on table "public"."feedback_blocks" to "anon";

grant select on table "public"."feedback_blocks" to "anon";

grant trigger on table "public"."feedback_blocks" to "anon";

grant truncate on table "public"."feedback_blocks" to "anon";

grant update on table "public"."feedback_blocks" to "anon";

grant delete on table "public"."feedback_blocks" to "authenticated";

grant insert on table "public"."feedback_blocks" to "authenticated";

grant references on table "public"."feedback_blocks" to "authenticated";

grant select on table "public"."feedback_blocks" to "authenticated";

grant trigger on table "public"."feedback_blocks" to "authenticated";

grant truncate on table "public"."feedback_blocks" to "authenticated";

grant update on table "public"."feedback_blocks" to "authenticated";

grant delete on table "public"."feedback_blocks" to "service_role";

grant insert on table "public"."feedback_blocks" to "service_role";

grant references on table "public"."feedback_blocks" to "service_role";

grant select on table "public"."feedback_blocks" to "service_role";

grant trigger on table "public"."feedback_blocks" to "service_role";

grant truncate on table "public"."feedback_blocks" to "service_role";

grant update on table "public"."feedback_blocks" to "service_role";

grant delete on table "public"."feedback_comment_read_status" to "anon";

grant insert on table "public"."feedback_comment_read_status" to "anon";

grant references on table "public"."feedback_comment_read_status" to "anon";

grant select on table "public"."feedback_comment_read_status" to "anon";

grant trigger on table "public"."feedback_comment_read_status" to "anon";

grant truncate on table "public"."feedback_comment_read_status" to "anon";

grant update on table "public"."feedback_comment_read_status" to "anon";

grant delete on table "public"."feedback_comment_read_status" to "authenticated";

grant insert on table "public"."feedback_comment_read_status" to "authenticated";

grant references on table "public"."feedback_comment_read_status" to "authenticated";

grant select on table "public"."feedback_comment_read_status" to "authenticated";

grant trigger on table "public"."feedback_comment_read_status" to "authenticated";

grant truncate on table "public"."feedback_comment_read_status" to "authenticated";

grant update on table "public"."feedback_comment_read_status" to "authenticated";

grant delete on table "public"."feedback_comment_read_status" to "service_role";

grant insert on table "public"."feedback_comment_read_status" to "service_role";

grant references on table "public"."feedback_comment_read_status" to "service_role";

grant select on table "public"."feedback_comment_read_status" to "service_role";

grant trigger on table "public"."feedback_comment_read_status" to "service_role";

grant truncate on table "public"."feedback_comment_read_status" to "service_role";

grant update on table "public"."feedback_comment_read_status" to "service_role";

grant delete on table "public"."feedback_comments" to "anon";

grant insert on table "public"."feedback_comments" to "anon";

grant references on table "public"."feedback_comments" to "anon";

grant select on table "public"."feedback_comments" to "anon";

grant trigger on table "public"."feedback_comments" to "anon";

grant truncate on table "public"."feedback_comments" to "anon";

grant update on table "public"."feedback_comments" to "anon";

grant delete on table "public"."feedback_comments" to "authenticated";

grant insert on table "public"."feedback_comments" to "authenticated";

grant references on table "public"."feedback_comments" to "authenticated";

grant select on table "public"."feedback_comments" to "authenticated";

grant trigger on table "public"."feedback_comments" to "authenticated";

grant truncate on table "public"."feedback_comments" to "authenticated";

grant update on table "public"."feedback_comments" to "authenticated";

grant delete on table "public"."feedback_comments" to "service_role";

grant insert on table "public"."feedback_comments" to "service_role";

grant references on table "public"."feedback_comments" to "service_role";

grant select on table "public"."feedback_comments" to "service_role";

grant trigger on table "public"."feedback_comments" to "service_role";

grant truncate on table "public"."feedback_comments" to "service_role";

grant update on table "public"."feedback_comments" to "service_role";

grant delete on table "public"."feedback_modules" to "anon";

grant insert on table "public"."feedback_modules" to "anon";

grant references on table "public"."feedback_modules" to "anon";

grant select on table "public"."feedback_modules" to "anon";

grant trigger on table "public"."feedback_modules" to "anon";

grant truncate on table "public"."feedback_modules" to "anon";

grant update on table "public"."feedback_modules" to "anon";

grant delete on table "public"."feedback_modules" to "authenticated";

grant insert on table "public"."feedback_modules" to "authenticated";

grant references on table "public"."feedback_modules" to "authenticated";

grant select on table "public"."feedback_modules" to "authenticated";

grant trigger on table "public"."feedback_modules" to "authenticated";

grant truncate on table "public"."feedback_modules" to "authenticated";

grant update on table "public"."feedback_modules" to "authenticated";

grant delete on table "public"."feedback_modules" to "service_role";

grant insert on table "public"."feedback_modules" to "service_role";

grant references on table "public"."feedback_modules" to "service_role";

grant select on table "public"."feedback_modules" to "service_role";

grant trigger on table "public"."feedback_modules" to "service_role";

grant truncate on table "public"."feedback_modules" to "service_role";

grant update on table "public"."feedback_modules" to "service_role";

grant delete on table "public"."feedback_responses" to "anon";

grant insert on table "public"."feedback_responses" to "anon";

grant references on table "public"."feedback_responses" to "anon";

grant select on table "public"."feedback_responses" to "anon";

grant trigger on table "public"."feedback_responses" to "anon";

grant truncate on table "public"."feedback_responses" to "anon";

grant update on table "public"."feedback_responses" to "anon";

grant delete on table "public"."feedback_responses" to "authenticated";

grant insert on table "public"."feedback_responses" to "authenticated";

grant references on table "public"."feedback_responses" to "authenticated";

grant select on table "public"."feedback_responses" to "authenticated";

grant trigger on table "public"."feedback_responses" to "authenticated";

grant truncate on table "public"."feedback_responses" to "authenticated";

grant update on table "public"."feedback_responses" to "authenticated";

grant delete on table "public"."feedback_responses" to "service_role";

grant insert on table "public"."feedback_responses" to "service_role";

grant references on table "public"."feedback_responses" to "service_role";

grant select on table "public"."feedback_responses" to "service_role";

grant trigger on table "public"."feedback_responses" to "service_role";

grant truncate on table "public"."feedback_responses" to "service_role";

grant update on table "public"."feedback_responses" to "service_role";

grant delete on table "public"."feedback_votes" to "anon";

grant insert on table "public"."feedback_votes" to "anon";

grant references on table "public"."feedback_votes" to "anon";

grant select on table "public"."feedback_votes" to "anon";

grant trigger on table "public"."feedback_votes" to "anon";

grant truncate on table "public"."feedback_votes" to "anon";

grant update on table "public"."feedback_votes" to "anon";

grant delete on table "public"."feedback_votes" to "authenticated";

grant insert on table "public"."feedback_votes" to "authenticated";

grant references on table "public"."feedback_votes" to "authenticated";

grant select on table "public"."feedback_votes" to "authenticated";

grant trigger on table "public"."feedback_votes" to "authenticated";

grant truncate on table "public"."feedback_votes" to "authenticated";

grant update on table "public"."feedback_votes" to "authenticated";

grant delete on table "public"."feedback_votes" to "service_role";

grant insert on table "public"."feedback_votes" to "service_role";

grant references on table "public"."feedback_votes" to "service_role";

grant select on table "public"."feedback_votes" to "service_role";

grant trigger on table "public"."feedback_votes" to "service_role";

grant truncate on table "public"."feedback_votes" to "service_role";

grant update on table "public"."feedback_votes" to "service_role";

grant delete on table "public"."issue_advertisements" to "anon";

grant insert on table "public"."issue_advertisements" to "anon";

grant references on table "public"."issue_advertisements" to "anon";

grant select on table "public"."issue_advertisements" to "anon";

grant trigger on table "public"."issue_advertisements" to "anon";

grant truncate on table "public"."issue_advertisements" to "anon";

grant update on table "public"."issue_advertisements" to "anon";

grant delete on table "public"."issue_advertisements" to "authenticated";

grant insert on table "public"."issue_advertisements" to "authenticated";

grant references on table "public"."issue_advertisements" to "authenticated";

grant select on table "public"."issue_advertisements" to "authenticated";

grant trigger on table "public"."issue_advertisements" to "authenticated";

grant truncate on table "public"."issue_advertisements" to "authenticated";

grant update on table "public"."issue_advertisements" to "authenticated";

grant delete on table "public"."issue_advertisements" to "service_role";

grant insert on table "public"."issue_advertisements" to "service_role";

grant references on table "public"."issue_advertisements" to "service_role";

grant select on table "public"."issue_advertisements" to "service_role";

grant trigger on table "public"."issue_advertisements" to "service_role";

grant truncate on table "public"."issue_advertisements" to "service_role";

grant update on table "public"."issue_advertisements" to "service_role";

grant delete on table "public"."issue_ai_app_modules" to "anon";

grant insert on table "public"."issue_ai_app_modules" to "anon";

grant references on table "public"."issue_ai_app_modules" to "anon";

grant select on table "public"."issue_ai_app_modules" to "anon";

grant trigger on table "public"."issue_ai_app_modules" to "anon";

grant truncate on table "public"."issue_ai_app_modules" to "anon";

grant update on table "public"."issue_ai_app_modules" to "anon";

grant delete on table "public"."issue_ai_app_modules" to "authenticated";

grant insert on table "public"."issue_ai_app_modules" to "authenticated";

grant references on table "public"."issue_ai_app_modules" to "authenticated";

grant select on table "public"."issue_ai_app_modules" to "authenticated";

grant trigger on table "public"."issue_ai_app_modules" to "authenticated";

grant truncate on table "public"."issue_ai_app_modules" to "authenticated";

grant update on table "public"."issue_ai_app_modules" to "authenticated";

grant delete on table "public"."issue_ai_app_modules" to "service_role";

grant insert on table "public"."issue_ai_app_modules" to "service_role";

grant references on table "public"."issue_ai_app_modules" to "service_role";

grant select on table "public"."issue_ai_app_modules" to "service_role";

grant trigger on table "public"."issue_ai_app_modules" to "service_role";

grant truncate on table "public"."issue_ai_app_modules" to "service_role";

grant update on table "public"."issue_ai_app_modules" to "service_role";

grant delete on table "public"."issue_ai_app_selections" to "anon";

grant insert on table "public"."issue_ai_app_selections" to "anon";

grant references on table "public"."issue_ai_app_selections" to "anon";

grant select on table "public"."issue_ai_app_selections" to "anon";

grant trigger on table "public"."issue_ai_app_selections" to "anon";

grant truncate on table "public"."issue_ai_app_selections" to "anon";

grant update on table "public"."issue_ai_app_selections" to "anon";

grant delete on table "public"."issue_ai_app_selections" to "authenticated";

grant insert on table "public"."issue_ai_app_selections" to "authenticated";

grant references on table "public"."issue_ai_app_selections" to "authenticated";

grant select on table "public"."issue_ai_app_selections" to "authenticated";

grant trigger on table "public"."issue_ai_app_selections" to "authenticated";

grant truncate on table "public"."issue_ai_app_selections" to "authenticated";

grant update on table "public"."issue_ai_app_selections" to "authenticated";

grant delete on table "public"."issue_ai_app_selections" to "service_role";

grant insert on table "public"."issue_ai_app_selections" to "service_role";

grant references on table "public"."issue_ai_app_selections" to "service_role";

grant select on table "public"."issue_ai_app_selections" to "service_role";

grant trigger on table "public"."issue_ai_app_selections" to "service_role";

grant truncate on table "public"."issue_ai_app_selections" to "service_role";

grant update on table "public"."issue_ai_app_selections" to "service_role";

grant delete on table "public"."issue_article_modules" to "anon";

grant insert on table "public"."issue_article_modules" to "anon";

grant references on table "public"."issue_article_modules" to "anon";

grant select on table "public"."issue_article_modules" to "anon";

grant trigger on table "public"."issue_article_modules" to "anon";

grant truncate on table "public"."issue_article_modules" to "anon";

grant update on table "public"."issue_article_modules" to "anon";

grant delete on table "public"."issue_article_modules" to "authenticated";

grant insert on table "public"."issue_article_modules" to "authenticated";

grant references on table "public"."issue_article_modules" to "authenticated";

grant select on table "public"."issue_article_modules" to "authenticated";

grant trigger on table "public"."issue_article_modules" to "authenticated";

grant truncate on table "public"."issue_article_modules" to "authenticated";

grant update on table "public"."issue_article_modules" to "authenticated";

grant delete on table "public"."issue_article_modules" to "service_role";

grant insert on table "public"."issue_article_modules" to "service_role";

grant references on table "public"."issue_article_modules" to "service_role";

grant select on table "public"."issue_article_modules" to "service_role";

grant trigger on table "public"."issue_article_modules" to "service_role";

grant truncate on table "public"."issue_article_modules" to "service_role";

grant update on table "public"."issue_article_modules" to "service_role";

grant delete on table "public"."issue_breaking_news" to "anon";

grant insert on table "public"."issue_breaking_news" to "anon";

grant references on table "public"."issue_breaking_news" to "anon";

grant select on table "public"."issue_breaking_news" to "anon";

grant trigger on table "public"."issue_breaking_news" to "anon";

grant truncate on table "public"."issue_breaking_news" to "anon";

grant update on table "public"."issue_breaking_news" to "anon";

grant delete on table "public"."issue_breaking_news" to "authenticated";

grant insert on table "public"."issue_breaking_news" to "authenticated";

grant references on table "public"."issue_breaking_news" to "authenticated";

grant select on table "public"."issue_breaking_news" to "authenticated";

grant trigger on table "public"."issue_breaking_news" to "authenticated";

grant truncate on table "public"."issue_breaking_news" to "authenticated";

grant update on table "public"."issue_breaking_news" to "authenticated";

grant delete on table "public"."issue_breaking_news" to "service_role";

grant insert on table "public"."issue_breaking_news" to "service_role";

grant references on table "public"."issue_breaking_news" to "service_role";

grant select on table "public"."issue_breaking_news" to "service_role";

grant trigger on table "public"."issue_breaking_news" to "service_role";

grant truncate on table "public"."issue_breaking_news" to "service_role";

grant update on table "public"."issue_breaking_news" to "service_role";

grant delete on table "public"."issue_events" to "anon";

grant insert on table "public"."issue_events" to "anon";

grant references on table "public"."issue_events" to "anon";

grant select on table "public"."issue_events" to "anon";

grant trigger on table "public"."issue_events" to "anon";

grant truncate on table "public"."issue_events" to "anon";

grant update on table "public"."issue_events" to "anon";

grant delete on table "public"."issue_events" to "authenticated";

grant insert on table "public"."issue_events" to "authenticated";

grant references on table "public"."issue_events" to "authenticated";

grant select on table "public"."issue_events" to "authenticated";

grant trigger on table "public"."issue_events" to "authenticated";

grant truncate on table "public"."issue_events" to "authenticated";

grant update on table "public"."issue_events" to "authenticated";

grant delete on table "public"."issue_events" to "service_role";

grant insert on table "public"."issue_events" to "service_role";

grant references on table "public"."issue_events" to "service_role";

grant select on table "public"."issue_events" to "service_role";

grant trigger on table "public"."issue_events" to "service_role";

grant truncate on table "public"."issue_events" to "service_role";

grant update on table "public"."issue_events" to "service_role";

grant delete on table "public"."issue_module_ads" to "anon";

grant insert on table "public"."issue_module_ads" to "anon";

grant references on table "public"."issue_module_ads" to "anon";

grant select on table "public"."issue_module_ads" to "anon";

grant trigger on table "public"."issue_module_ads" to "anon";

grant truncate on table "public"."issue_module_ads" to "anon";

grant update on table "public"."issue_module_ads" to "anon";

grant delete on table "public"."issue_module_ads" to "authenticated";

grant insert on table "public"."issue_module_ads" to "authenticated";

grant references on table "public"."issue_module_ads" to "authenticated";

grant select on table "public"."issue_module_ads" to "authenticated";

grant trigger on table "public"."issue_module_ads" to "authenticated";

grant truncate on table "public"."issue_module_ads" to "authenticated";

grant update on table "public"."issue_module_ads" to "authenticated";

grant delete on table "public"."issue_module_ads" to "service_role";

grant insert on table "public"."issue_module_ads" to "service_role";

grant references on table "public"."issue_module_ads" to "service_role";

grant select on table "public"."issue_module_ads" to "service_role";

grant trigger on table "public"."issue_module_ads" to "service_role";

grant truncate on table "public"."issue_module_ads" to "service_role";

grant update on table "public"."issue_module_ads" to "service_role";

grant delete on table "public"."issue_poll_modules" to "anon";

grant insert on table "public"."issue_poll_modules" to "anon";

grant references on table "public"."issue_poll_modules" to "anon";

grant select on table "public"."issue_poll_modules" to "anon";

grant trigger on table "public"."issue_poll_modules" to "anon";

grant truncate on table "public"."issue_poll_modules" to "anon";

grant update on table "public"."issue_poll_modules" to "anon";

grant delete on table "public"."issue_poll_modules" to "authenticated";

grant insert on table "public"."issue_poll_modules" to "authenticated";

grant references on table "public"."issue_poll_modules" to "authenticated";

grant select on table "public"."issue_poll_modules" to "authenticated";

grant trigger on table "public"."issue_poll_modules" to "authenticated";

grant truncate on table "public"."issue_poll_modules" to "authenticated";

grant update on table "public"."issue_poll_modules" to "authenticated";

grant delete on table "public"."issue_poll_modules" to "service_role";

grant insert on table "public"."issue_poll_modules" to "service_role";

grant references on table "public"."issue_poll_modules" to "service_role";

grant select on table "public"."issue_poll_modules" to "service_role";

grant trigger on table "public"."issue_poll_modules" to "service_role";

grant truncate on table "public"."issue_poll_modules" to "service_role";

grant update on table "public"."issue_poll_modules" to "service_role";

grant delete on table "public"."issue_prompt_modules" to "anon";

grant insert on table "public"."issue_prompt_modules" to "anon";

grant references on table "public"."issue_prompt_modules" to "anon";

grant select on table "public"."issue_prompt_modules" to "anon";

grant trigger on table "public"."issue_prompt_modules" to "anon";

grant truncate on table "public"."issue_prompt_modules" to "anon";

grant update on table "public"."issue_prompt_modules" to "anon";

grant delete on table "public"."issue_prompt_modules" to "authenticated";

grant insert on table "public"."issue_prompt_modules" to "authenticated";

grant references on table "public"."issue_prompt_modules" to "authenticated";

grant select on table "public"."issue_prompt_modules" to "authenticated";

grant trigger on table "public"."issue_prompt_modules" to "authenticated";

grant truncate on table "public"."issue_prompt_modules" to "authenticated";

grant update on table "public"."issue_prompt_modules" to "authenticated";

grant delete on table "public"."issue_prompt_modules" to "service_role";

grant insert on table "public"."issue_prompt_modules" to "service_role";

grant references on table "public"."issue_prompt_modules" to "service_role";

grant select on table "public"."issue_prompt_modules" to "service_role";

grant trigger on table "public"."issue_prompt_modules" to "service_role";

grant truncate on table "public"."issue_prompt_modules" to "service_role";

grant update on table "public"."issue_prompt_modules" to "service_role";

grant delete on table "public"."issue_prompt_selections" to "anon";

grant insert on table "public"."issue_prompt_selections" to "anon";

grant references on table "public"."issue_prompt_selections" to "anon";

grant select on table "public"."issue_prompt_selections" to "anon";

grant trigger on table "public"."issue_prompt_selections" to "anon";

grant truncate on table "public"."issue_prompt_selections" to "anon";

grant update on table "public"."issue_prompt_selections" to "anon";

grant delete on table "public"."issue_prompt_selections" to "authenticated";

grant insert on table "public"."issue_prompt_selections" to "authenticated";

grant references on table "public"."issue_prompt_selections" to "authenticated";

grant select on table "public"."issue_prompt_selections" to "authenticated";

grant trigger on table "public"."issue_prompt_selections" to "authenticated";

grant truncate on table "public"."issue_prompt_selections" to "authenticated";

grant update on table "public"."issue_prompt_selections" to "authenticated";

grant delete on table "public"."issue_prompt_selections" to "service_role";

grant insert on table "public"."issue_prompt_selections" to "service_role";

grant references on table "public"."issue_prompt_selections" to "service_role";

grant select on table "public"."issue_prompt_selections" to "service_role";

grant trigger on table "public"."issue_prompt_selections" to "service_role";

grant truncate on table "public"."issue_prompt_selections" to "service_role";

grant update on table "public"."issue_prompt_selections" to "service_role";

grant delete on table "public"."issue_sparkloop_rec_modules" to "anon";

grant insert on table "public"."issue_sparkloop_rec_modules" to "anon";

grant references on table "public"."issue_sparkloop_rec_modules" to "anon";

grant select on table "public"."issue_sparkloop_rec_modules" to "anon";

grant trigger on table "public"."issue_sparkloop_rec_modules" to "anon";

grant truncate on table "public"."issue_sparkloop_rec_modules" to "anon";

grant update on table "public"."issue_sparkloop_rec_modules" to "anon";

grant delete on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant insert on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant references on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant select on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant trigger on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant truncate on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant update on table "public"."issue_sparkloop_rec_modules" to "authenticated";

grant delete on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant insert on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant references on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant select on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant trigger on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant truncate on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant update on table "public"."issue_sparkloop_rec_modules" to "service_role";

grant delete on table "public"."issue_text_box_blocks" to "anon";

grant insert on table "public"."issue_text_box_blocks" to "anon";

grant references on table "public"."issue_text_box_blocks" to "anon";

grant select on table "public"."issue_text_box_blocks" to "anon";

grant trigger on table "public"."issue_text_box_blocks" to "anon";

grant truncate on table "public"."issue_text_box_blocks" to "anon";

grant update on table "public"."issue_text_box_blocks" to "anon";

grant delete on table "public"."issue_text_box_blocks" to "authenticated";

grant insert on table "public"."issue_text_box_blocks" to "authenticated";

grant references on table "public"."issue_text_box_blocks" to "authenticated";

grant select on table "public"."issue_text_box_blocks" to "authenticated";

grant trigger on table "public"."issue_text_box_blocks" to "authenticated";

grant truncate on table "public"."issue_text_box_blocks" to "authenticated";

grant update on table "public"."issue_text_box_blocks" to "authenticated";

grant delete on table "public"."issue_text_box_blocks" to "service_role";

grant insert on table "public"."issue_text_box_blocks" to "service_role";

grant references on table "public"."issue_text_box_blocks" to "service_role";

grant select on table "public"."issue_text_box_blocks" to "service_role";

grant trigger on table "public"."issue_text_box_blocks" to "service_role";

grant truncate on table "public"."issue_text_box_blocks" to "service_role";

grant update on table "public"."issue_text_box_blocks" to "service_role";

grant delete on table "public"."issue_text_box_modules" to "anon";

grant insert on table "public"."issue_text_box_modules" to "anon";

grant references on table "public"."issue_text_box_modules" to "anon";

grant select on table "public"."issue_text_box_modules" to "anon";

grant trigger on table "public"."issue_text_box_modules" to "anon";

grant truncate on table "public"."issue_text_box_modules" to "anon";

grant update on table "public"."issue_text_box_modules" to "anon";

grant delete on table "public"."issue_text_box_modules" to "authenticated";

grant insert on table "public"."issue_text_box_modules" to "authenticated";

grant references on table "public"."issue_text_box_modules" to "authenticated";

grant select on table "public"."issue_text_box_modules" to "authenticated";

grant trigger on table "public"."issue_text_box_modules" to "authenticated";

grant truncate on table "public"."issue_text_box_modules" to "authenticated";

grant update on table "public"."issue_text_box_modules" to "authenticated";

grant delete on table "public"."issue_text_box_modules" to "service_role";

grant insert on table "public"."issue_text_box_modules" to "service_role";

grant references on table "public"."issue_text_box_modules" to "service_role";

grant select on table "public"."issue_text_box_modules" to "service_role";

grant trigger on table "public"."issue_text_box_modules" to "service_role";

grant truncate on table "public"."issue_text_box_modules" to "service_role";

grant update on table "public"."issue_text_box_modules" to "service_role";

grant delete on table "public"."link_clicks" to "anon";

grant insert on table "public"."link_clicks" to "anon";

grant references on table "public"."link_clicks" to "anon";

grant select on table "public"."link_clicks" to "anon";

grant trigger on table "public"."link_clicks" to "anon";

grant truncate on table "public"."link_clicks" to "anon";

grant update on table "public"."link_clicks" to "anon";

grant delete on table "public"."link_clicks" to "authenticated";

grant insert on table "public"."link_clicks" to "authenticated";

grant references on table "public"."link_clicks" to "authenticated";

grant select on table "public"."link_clicks" to "authenticated";

grant trigger on table "public"."link_clicks" to "authenticated";

grant truncate on table "public"."link_clicks" to "authenticated";

grant update on table "public"."link_clicks" to "authenticated";

grant delete on table "public"."link_clicks" to "service_role";

grant insert on table "public"."link_clicks" to "service_role";

grant references on table "public"."link_clicks" to "service_role";

grant select on table "public"."link_clicks" to "service_role";

grant trigger on table "public"."link_clicks" to "service_role";

grant truncate on table "public"."link_clicks" to "service_role";

grant update on table "public"."link_clicks" to "service_role";

grant delete on table "public"."mailerlite_field_updates" to "anon";

grant insert on table "public"."mailerlite_field_updates" to "anon";

grant references on table "public"."mailerlite_field_updates" to "anon";

grant select on table "public"."mailerlite_field_updates" to "anon";

grant trigger on table "public"."mailerlite_field_updates" to "anon";

grant truncate on table "public"."mailerlite_field_updates" to "anon";

grant update on table "public"."mailerlite_field_updates" to "anon";

grant delete on table "public"."mailerlite_field_updates" to "authenticated";

grant insert on table "public"."mailerlite_field_updates" to "authenticated";

grant references on table "public"."mailerlite_field_updates" to "authenticated";

grant select on table "public"."mailerlite_field_updates" to "authenticated";

grant trigger on table "public"."mailerlite_field_updates" to "authenticated";

grant truncate on table "public"."mailerlite_field_updates" to "authenticated";

grant update on table "public"."mailerlite_field_updates" to "authenticated";

grant delete on table "public"."mailerlite_field_updates" to "service_role";

grant insert on table "public"."mailerlite_field_updates" to "service_role";

grant references on table "public"."mailerlite_field_updates" to "service_role";

grant select on table "public"."mailerlite_field_updates" to "service_role";

grant trigger on table "public"."mailerlite_field_updates" to "service_role";

grant truncate on table "public"."mailerlite_field_updates" to "service_role";

grant update on table "public"."mailerlite_field_updates" to "service_role";

grant delete on table "public"."manual_articles" to "anon";

grant insert on table "public"."manual_articles" to "anon";

grant references on table "public"."manual_articles" to "anon";

grant select on table "public"."manual_articles" to "anon";

grant trigger on table "public"."manual_articles" to "anon";

grant truncate on table "public"."manual_articles" to "anon";

grant update on table "public"."manual_articles" to "anon";

grant delete on table "public"."manual_articles" to "authenticated";

grant insert on table "public"."manual_articles" to "authenticated";

grant references on table "public"."manual_articles" to "authenticated";

grant select on table "public"."manual_articles" to "authenticated";

grant trigger on table "public"."manual_articles" to "authenticated";

grant truncate on table "public"."manual_articles" to "authenticated";

grant update on table "public"."manual_articles" to "authenticated";

grant delete on table "public"."manual_articles" to "service_role";

grant insert on table "public"."manual_articles" to "service_role";

grant references on table "public"."manual_articles" to "service_role";

grant select on table "public"."manual_articles" to "service_role";

grant trigger on table "public"."manual_articles" to "service_role";

grant truncate on table "public"."manual_articles" to "service_role";

grant update on table "public"."manual_articles" to "service_role";

grant delete on table "public"."module_articles" to "anon";

grant insert on table "public"."module_articles" to "anon";

grant references on table "public"."module_articles" to "anon";

grant select on table "public"."module_articles" to "anon";

grant trigger on table "public"."module_articles" to "anon";

grant truncate on table "public"."module_articles" to "anon";

grant update on table "public"."module_articles" to "anon";

grant delete on table "public"."module_articles" to "authenticated";

grant insert on table "public"."module_articles" to "authenticated";

grant references on table "public"."module_articles" to "authenticated";

grant select on table "public"."module_articles" to "authenticated";

grant trigger on table "public"."module_articles" to "authenticated";

grant truncate on table "public"."module_articles" to "authenticated";

grant update on table "public"."module_articles" to "authenticated";

grant delete on table "public"."module_articles" to "service_role";

grant insert on table "public"."module_articles" to "service_role";

grant references on table "public"."module_articles" to "service_role";

grant select on table "public"."module_articles" to "service_role";

grant trigger on table "public"."module_articles" to "service_role";

grant truncate on table "public"."module_articles" to "service_role";

grant update on table "public"."module_articles" to "service_role";

grant delete on table "public"."newsletter_sections" to "anon";

grant insert on table "public"."newsletter_sections" to "anon";

grant references on table "public"."newsletter_sections" to "anon";

grant select on table "public"."newsletter_sections" to "anon";

grant trigger on table "public"."newsletter_sections" to "anon";

grant truncate on table "public"."newsletter_sections" to "anon";

grant update on table "public"."newsletter_sections" to "anon";

grant delete on table "public"."newsletter_sections" to "authenticated";

grant insert on table "public"."newsletter_sections" to "authenticated";

grant references on table "public"."newsletter_sections" to "authenticated";

grant select on table "public"."newsletter_sections" to "authenticated";

grant trigger on table "public"."newsletter_sections" to "authenticated";

grant truncate on table "public"."newsletter_sections" to "authenticated";

grant update on table "public"."newsletter_sections" to "authenticated";

grant delete on table "public"."newsletter_sections" to "service_role";

grant insert on table "public"."newsletter_sections" to "service_role";

grant references on table "public"."newsletter_sections" to "service_role";

grant select on table "public"."newsletter_sections" to "service_role";

grant trigger on table "public"."newsletter_sections" to "service_role";

grant truncate on table "public"."newsletter_sections" to "service_role";

grant update on table "public"."newsletter_sections" to "service_role";

grant delete on table "public"."pending_event_submissions" to "anon";

grant insert on table "public"."pending_event_submissions" to "anon";

grant references on table "public"."pending_event_submissions" to "anon";

grant select on table "public"."pending_event_submissions" to "anon";

grant trigger on table "public"."pending_event_submissions" to "anon";

grant truncate on table "public"."pending_event_submissions" to "anon";

grant update on table "public"."pending_event_submissions" to "anon";

grant delete on table "public"."pending_event_submissions" to "authenticated";

grant insert on table "public"."pending_event_submissions" to "authenticated";

grant references on table "public"."pending_event_submissions" to "authenticated";

grant select on table "public"."pending_event_submissions" to "authenticated";

grant trigger on table "public"."pending_event_submissions" to "authenticated";

grant truncate on table "public"."pending_event_submissions" to "authenticated";

grant update on table "public"."pending_event_submissions" to "authenticated";

grant delete on table "public"."pending_event_submissions" to "service_role";

grant insert on table "public"."pending_event_submissions" to "service_role";

grant references on table "public"."pending_event_submissions" to "service_role";

grant select on table "public"."pending_event_submissions" to "service_role";

grant trigger on table "public"."pending_event_submissions" to "service_role";

grant truncate on table "public"."pending_event_submissions" to "service_role";

grant update on table "public"."pending_event_submissions" to "service_role";

grant delete on table "public"."poll_modules" to "anon";

grant insert on table "public"."poll_modules" to "anon";

grant references on table "public"."poll_modules" to "anon";

grant select on table "public"."poll_modules" to "anon";

grant trigger on table "public"."poll_modules" to "anon";

grant truncate on table "public"."poll_modules" to "anon";

grant update on table "public"."poll_modules" to "anon";

grant delete on table "public"."poll_modules" to "authenticated";

grant insert on table "public"."poll_modules" to "authenticated";

grant references on table "public"."poll_modules" to "authenticated";

grant select on table "public"."poll_modules" to "authenticated";

grant trigger on table "public"."poll_modules" to "authenticated";

grant truncate on table "public"."poll_modules" to "authenticated";

grant update on table "public"."poll_modules" to "authenticated";

grant delete on table "public"."poll_modules" to "service_role";

grant insert on table "public"."poll_modules" to "service_role";

grant references on table "public"."poll_modules" to "service_role";

grant select on table "public"."poll_modules" to "service_role";

grant trigger on table "public"."poll_modules" to "service_role";

grant truncate on table "public"."poll_modules" to "service_role";

grant update on table "public"."poll_modules" to "service_role";

grant delete on table "public"."poll_responses" to "anon";

grant insert on table "public"."poll_responses" to "anon";

grant references on table "public"."poll_responses" to "anon";

grant select on table "public"."poll_responses" to "anon";

grant trigger on table "public"."poll_responses" to "anon";

grant truncate on table "public"."poll_responses" to "anon";

grant update on table "public"."poll_responses" to "anon";

grant delete on table "public"."poll_responses" to "authenticated";

grant insert on table "public"."poll_responses" to "authenticated";

grant references on table "public"."poll_responses" to "authenticated";

grant select on table "public"."poll_responses" to "authenticated";

grant trigger on table "public"."poll_responses" to "authenticated";

grant truncate on table "public"."poll_responses" to "authenticated";

grant update on table "public"."poll_responses" to "authenticated";

grant delete on table "public"."poll_responses" to "service_role";

grant insert on table "public"."poll_responses" to "service_role";

grant references on table "public"."poll_responses" to "service_role";

grant select on table "public"."poll_responses" to "service_role";

grant trigger on table "public"."poll_responses" to "service_role";

grant truncate on table "public"."poll_responses" to "service_role";

grant update on table "public"."poll_responses" to "service_role";

grant delete on table "public"."polls" to "anon";

grant insert on table "public"."polls" to "anon";

grant references on table "public"."polls" to "anon";

grant select on table "public"."polls" to "anon";

grant trigger on table "public"."polls" to "anon";

grant truncate on table "public"."polls" to "anon";

grant update on table "public"."polls" to "anon";

grant delete on table "public"."polls" to "authenticated";

grant insert on table "public"."polls" to "authenticated";

grant references on table "public"."polls" to "authenticated";

grant select on table "public"."polls" to "authenticated";

grant trigger on table "public"."polls" to "authenticated";

grant truncate on table "public"."polls" to "authenticated";

grant update on table "public"."polls" to "authenticated";

grant delete on table "public"."polls" to "service_role";

grant insert on table "public"."polls" to "service_role";

grant references on table "public"."polls" to "service_role";

grant select on table "public"."polls" to "service_role";

grant trigger on table "public"."polls" to "service_role";

grant truncate on table "public"."polls" to "service_role";

grant update on table "public"."polls" to "service_role";

grant delete on table "public"."post_ratings" to "anon";

grant insert on table "public"."post_ratings" to "anon";

grant references on table "public"."post_ratings" to "anon";

grant select on table "public"."post_ratings" to "anon";

grant trigger on table "public"."post_ratings" to "anon";

grant truncate on table "public"."post_ratings" to "anon";

grant update on table "public"."post_ratings" to "anon";

grant delete on table "public"."post_ratings" to "authenticated";

grant insert on table "public"."post_ratings" to "authenticated";

grant references on table "public"."post_ratings" to "authenticated";

grant select on table "public"."post_ratings" to "authenticated";

grant trigger on table "public"."post_ratings" to "authenticated";

grant truncate on table "public"."post_ratings" to "authenticated";

grant update on table "public"."post_ratings" to "authenticated";

grant delete on table "public"."post_ratings" to "service_role";

grant insert on table "public"."post_ratings" to "service_role";

grant references on table "public"."post_ratings" to "service_role";

grant select on table "public"."post_ratings" to "service_role";

grant trigger on table "public"."post_ratings" to "service_role";

grant truncate on table "public"."post_ratings" to "service_role";

grant update on table "public"."post_ratings" to "service_role";

grant delete on table "public"."prompt_ideas" to "anon";

grant insert on table "public"."prompt_ideas" to "anon";

grant references on table "public"."prompt_ideas" to "anon";

grant select on table "public"."prompt_ideas" to "anon";

grant trigger on table "public"."prompt_ideas" to "anon";

grant truncate on table "public"."prompt_ideas" to "anon";

grant update on table "public"."prompt_ideas" to "anon";

grant delete on table "public"."prompt_ideas" to "authenticated";

grant insert on table "public"."prompt_ideas" to "authenticated";

grant references on table "public"."prompt_ideas" to "authenticated";

grant select on table "public"."prompt_ideas" to "authenticated";

grant trigger on table "public"."prompt_ideas" to "authenticated";

grant truncate on table "public"."prompt_ideas" to "authenticated";

grant update on table "public"."prompt_ideas" to "authenticated";

grant delete on table "public"."prompt_ideas" to "service_role";

grant insert on table "public"."prompt_ideas" to "service_role";

grant references on table "public"."prompt_ideas" to "service_role";

grant select on table "public"."prompt_ideas" to "service_role";

grant trigger on table "public"."prompt_ideas" to "service_role";

grant truncate on table "public"."prompt_ideas" to "service_role";

grant update on table "public"."prompt_ideas" to "service_role";

grant delete on table "public"."prompt_modules" to "anon";

grant insert on table "public"."prompt_modules" to "anon";

grant references on table "public"."prompt_modules" to "anon";

grant select on table "public"."prompt_modules" to "anon";

grant trigger on table "public"."prompt_modules" to "anon";

grant truncate on table "public"."prompt_modules" to "anon";

grant update on table "public"."prompt_modules" to "anon";

grant delete on table "public"."prompt_modules" to "authenticated";

grant insert on table "public"."prompt_modules" to "authenticated";

grant references on table "public"."prompt_modules" to "authenticated";

grant select on table "public"."prompt_modules" to "authenticated";

grant trigger on table "public"."prompt_modules" to "authenticated";

grant truncate on table "public"."prompt_modules" to "authenticated";

grant update on table "public"."prompt_modules" to "authenticated";

grant delete on table "public"."prompt_modules" to "service_role";

grant insert on table "public"."prompt_modules" to "service_role";

grant references on table "public"."prompt_modules" to "service_role";

grant select on table "public"."prompt_modules" to "service_role";

grant trigger on table "public"."prompt_modules" to "service_role";

grant truncate on table "public"."prompt_modules" to "service_role";

grant update on table "public"."prompt_modules" to "service_role";

grant delete on table "public"."publication_issues" to "anon";

grant insert on table "public"."publication_issues" to "anon";

grant references on table "public"."publication_issues" to "anon";

grant select on table "public"."publication_issues" to "anon";

grant trigger on table "public"."publication_issues" to "anon";

grant truncate on table "public"."publication_issues" to "anon";

grant update on table "public"."publication_issues" to "anon";

grant delete on table "public"."publication_issues" to "authenticated";

grant insert on table "public"."publication_issues" to "authenticated";

grant references on table "public"."publication_issues" to "authenticated";

grant select on table "public"."publication_issues" to "authenticated";

grant trigger on table "public"."publication_issues" to "authenticated";

grant truncate on table "public"."publication_issues" to "authenticated";

grant update on table "public"."publication_issues" to "authenticated";

grant delete on table "public"."publication_issues" to "service_role";

grant insert on table "public"."publication_issues" to "service_role";

grant references on table "public"."publication_issues" to "service_role";

grant select on table "public"."publication_issues" to "service_role";

grant trigger on table "public"."publication_issues" to "service_role";

grant truncate on table "public"."publication_issues" to "service_role";

grant update on table "public"."publication_issues" to "service_role";

grant delete on table "public"."publication_settings" to "anon";

grant insert on table "public"."publication_settings" to "anon";

grant references on table "public"."publication_settings" to "anon";

grant select on table "public"."publication_settings" to "anon";

grant trigger on table "public"."publication_settings" to "anon";

grant truncate on table "public"."publication_settings" to "anon";

grant update on table "public"."publication_settings" to "anon";

grant delete on table "public"."publication_settings" to "authenticated";

grant insert on table "public"."publication_settings" to "authenticated";

grant references on table "public"."publication_settings" to "authenticated";

grant select on table "public"."publication_settings" to "authenticated";

grant trigger on table "public"."publication_settings" to "authenticated";

grant truncate on table "public"."publication_settings" to "authenticated";

grant update on table "public"."publication_settings" to "authenticated";

grant delete on table "public"."publication_settings" to "service_role";

grant insert on table "public"."publication_settings" to "service_role";

grant references on table "public"."publication_settings" to "service_role";

grant select on table "public"."publication_settings" to "service_role";

grant trigger on table "public"."publication_settings" to "service_role";

grant truncate on table "public"."publication_settings" to "service_role";

grant update on table "public"."publication_settings" to "service_role";

grant delete on table "public"."publications" to "anon";

grant insert on table "public"."publications" to "anon";

grant references on table "public"."publications" to "anon";

grant select on table "public"."publications" to "anon";

grant trigger on table "public"."publications" to "anon";

grant truncate on table "public"."publications" to "anon";

grant update on table "public"."publications" to "anon";

grant delete on table "public"."publications" to "authenticated";

grant insert on table "public"."publications" to "authenticated";

grant references on table "public"."publications" to "authenticated";

grant select on table "public"."publications" to "authenticated";

grant trigger on table "public"."publications" to "authenticated";

grant truncate on table "public"."publications" to "authenticated";

grant update on table "public"."publications" to "authenticated";

grant delete on table "public"."publications" to "service_role";

grant insert on table "public"."publications" to "service_role";

grant references on table "public"."publications" to "service_role";

grant select on table "public"."publications" to "service_role";

grant trigger on table "public"."publications" to "service_role";

grant truncate on table "public"."publications" to "service_role";

grant update on table "public"."publications" to "service_role";

grant delete on table "public"."rss_feeds" to "anon";

grant insert on table "public"."rss_feeds" to "anon";

grant references on table "public"."rss_feeds" to "anon";

grant select on table "public"."rss_feeds" to "anon";

grant trigger on table "public"."rss_feeds" to "anon";

grant truncate on table "public"."rss_feeds" to "anon";

grant update on table "public"."rss_feeds" to "anon";

grant delete on table "public"."rss_feeds" to "authenticated";

grant insert on table "public"."rss_feeds" to "authenticated";

grant references on table "public"."rss_feeds" to "authenticated";

grant select on table "public"."rss_feeds" to "authenticated";

grant trigger on table "public"."rss_feeds" to "authenticated";

grant truncate on table "public"."rss_feeds" to "authenticated";

grant update on table "public"."rss_feeds" to "authenticated";

grant delete on table "public"."rss_feeds" to "service_role";

grant insert on table "public"."rss_feeds" to "service_role";

grant references on table "public"."rss_feeds" to "service_role";

grant select on table "public"."rss_feeds" to "service_role";

grant trigger on table "public"."rss_feeds" to "service_role";

grant truncate on table "public"."rss_feeds" to "service_role";

grant update on table "public"."rss_feeds" to "service_role";

grant delete on table "public"."rss_posts" to "anon";

grant insert on table "public"."rss_posts" to "anon";

grant references on table "public"."rss_posts" to "anon";

grant select on table "public"."rss_posts" to "anon";

grant trigger on table "public"."rss_posts" to "anon";

grant truncate on table "public"."rss_posts" to "anon";

grant update on table "public"."rss_posts" to "anon";

grant delete on table "public"."rss_posts" to "authenticated";

grant insert on table "public"."rss_posts" to "authenticated";

grant references on table "public"."rss_posts" to "authenticated";

grant select on table "public"."rss_posts" to "authenticated";

grant trigger on table "public"."rss_posts" to "authenticated";

grant truncate on table "public"."rss_posts" to "authenticated";

grant update on table "public"."rss_posts" to "authenticated";

grant delete on table "public"."rss_posts" to "service_role";

grant insert on table "public"."rss_posts" to "service_role";

grant references on table "public"."rss_posts" to "service_role";

grant select on table "public"."rss_posts" to "service_role";

grant trigger on table "public"."rss_posts" to "service_role";

grant truncate on table "public"."rss_posts" to "service_role";

grant update on table "public"."rss_posts" to "service_role";

grant delete on table "public"."secondary_articles" to "anon";

grant insert on table "public"."secondary_articles" to "anon";

grant references on table "public"."secondary_articles" to "anon";

grant select on table "public"."secondary_articles" to "anon";

grant trigger on table "public"."secondary_articles" to "anon";

grant truncate on table "public"."secondary_articles" to "anon";

grant update on table "public"."secondary_articles" to "anon";

grant delete on table "public"."secondary_articles" to "authenticated";

grant insert on table "public"."secondary_articles" to "authenticated";

grant references on table "public"."secondary_articles" to "authenticated";

grant select on table "public"."secondary_articles" to "authenticated";

grant trigger on table "public"."secondary_articles" to "authenticated";

grant truncate on table "public"."secondary_articles" to "authenticated";

grant update on table "public"."secondary_articles" to "authenticated";

grant delete on table "public"."secondary_articles" to "service_role";

grant insert on table "public"."secondary_articles" to "service_role";

grant references on table "public"."secondary_articles" to "service_role";

grant select on table "public"."secondary_articles" to "service_role";

grant trigger on table "public"."secondary_articles" to "service_role";

grant truncate on table "public"."secondary_articles" to "service_role";

grant update on table "public"."secondary_articles" to "service_role";

grant delete on table "public"."sendgrid_field_updates" to "anon";

grant insert on table "public"."sendgrid_field_updates" to "anon";

grant references on table "public"."sendgrid_field_updates" to "anon";

grant select on table "public"."sendgrid_field_updates" to "anon";

grant trigger on table "public"."sendgrid_field_updates" to "anon";

grant truncate on table "public"."sendgrid_field_updates" to "anon";

grant update on table "public"."sendgrid_field_updates" to "anon";

grant delete on table "public"."sendgrid_field_updates" to "authenticated";

grant insert on table "public"."sendgrid_field_updates" to "authenticated";

grant references on table "public"."sendgrid_field_updates" to "authenticated";

grant select on table "public"."sendgrid_field_updates" to "authenticated";

grant trigger on table "public"."sendgrid_field_updates" to "authenticated";

grant truncate on table "public"."sendgrid_field_updates" to "authenticated";

grant update on table "public"."sendgrid_field_updates" to "authenticated";

grant delete on table "public"."sendgrid_field_updates" to "service_role";

grant insert on table "public"."sendgrid_field_updates" to "service_role";

grant references on table "public"."sendgrid_field_updates" to "service_role";

grant select on table "public"."sendgrid_field_updates" to "service_role";

grant trigger on table "public"."sendgrid_field_updates" to "service_role";

grant truncate on table "public"."sendgrid_field_updates" to "service_role";

grant update on table "public"."sendgrid_field_updates" to "service_role";

grant delete on table "public"."sparkloop_daily_snapshots" to "anon";

grant insert on table "public"."sparkloop_daily_snapshots" to "anon";

grant references on table "public"."sparkloop_daily_snapshots" to "anon";

grant select on table "public"."sparkloop_daily_snapshots" to "anon";

grant trigger on table "public"."sparkloop_daily_snapshots" to "anon";

grant truncate on table "public"."sparkloop_daily_snapshots" to "anon";

grant update on table "public"."sparkloop_daily_snapshots" to "anon";

grant delete on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant insert on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant references on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant select on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant trigger on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant truncate on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant update on table "public"."sparkloop_daily_snapshots" to "authenticated";

grant delete on table "public"."sparkloop_daily_snapshots" to "service_role";

grant insert on table "public"."sparkloop_daily_snapshots" to "service_role";

grant references on table "public"."sparkloop_daily_snapshots" to "service_role";

grant select on table "public"."sparkloop_daily_snapshots" to "service_role";

grant trigger on table "public"."sparkloop_daily_snapshots" to "service_role";

grant truncate on table "public"."sparkloop_daily_snapshots" to "service_role";

grant update on table "public"."sparkloop_daily_snapshots" to "service_role";

grant delete on table "public"."sparkloop_events" to "anon";

grant insert on table "public"."sparkloop_events" to "anon";

grant references on table "public"."sparkloop_events" to "anon";

grant select on table "public"."sparkloop_events" to "anon";

grant trigger on table "public"."sparkloop_events" to "anon";

grant truncate on table "public"."sparkloop_events" to "anon";

grant update on table "public"."sparkloop_events" to "anon";

grant delete on table "public"."sparkloop_events" to "authenticated";

grant insert on table "public"."sparkloop_events" to "authenticated";

grant references on table "public"."sparkloop_events" to "authenticated";

grant select on table "public"."sparkloop_events" to "authenticated";

grant trigger on table "public"."sparkloop_events" to "authenticated";

grant truncate on table "public"."sparkloop_events" to "authenticated";

grant update on table "public"."sparkloop_events" to "authenticated";

grant delete on table "public"."sparkloop_events" to "service_role";

grant insert on table "public"."sparkloop_events" to "service_role";

grant references on table "public"."sparkloop_events" to "service_role";

grant select on table "public"."sparkloop_events" to "service_role";

grant trigger on table "public"."sparkloop_events" to "service_role";

grant truncate on table "public"."sparkloop_events" to "service_role";

grant update on table "public"."sparkloop_events" to "service_role";

grant delete on table "public"."sparkloop_module_clicks" to "anon";

grant insert on table "public"."sparkloop_module_clicks" to "anon";

grant references on table "public"."sparkloop_module_clicks" to "anon";

grant select on table "public"."sparkloop_module_clicks" to "anon";

grant trigger on table "public"."sparkloop_module_clicks" to "anon";

grant truncate on table "public"."sparkloop_module_clicks" to "anon";

grant update on table "public"."sparkloop_module_clicks" to "anon";

grant delete on table "public"."sparkloop_module_clicks" to "authenticated";

grant insert on table "public"."sparkloop_module_clicks" to "authenticated";

grant references on table "public"."sparkloop_module_clicks" to "authenticated";

grant select on table "public"."sparkloop_module_clicks" to "authenticated";

grant trigger on table "public"."sparkloop_module_clicks" to "authenticated";

grant truncate on table "public"."sparkloop_module_clicks" to "authenticated";

grant update on table "public"."sparkloop_module_clicks" to "authenticated";

grant delete on table "public"."sparkloop_module_clicks" to "service_role";

grant insert on table "public"."sparkloop_module_clicks" to "service_role";

grant references on table "public"."sparkloop_module_clicks" to "service_role";

grant select on table "public"."sparkloop_module_clicks" to "service_role";

grant trigger on table "public"."sparkloop_module_clicks" to "service_role";

grant truncate on table "public"."sparkloop_module_clicks" to "service_role";

grant update on table "public"."sparkloop_module_clicks" to "service_role";

grant delete on table "public"."sparkloop_offer_events" to "anon";

grant insert on table "public"."sparkloop_offer_events" to "anon";

grant references on table "public"."sparkloop_offer_events" to "anon";

grant select on table "public"."sparkloop_offer_events" to "anon";

grant trigger on table "public"."sparkloop_offer_events" to "anon";

grant truncate on table "public"."sparkloop_offer_events" to "anon";

grant update on table "public"."sparkloop_offer_events" to "anon";

grant delete on table "public"."sparkloop_offer_events" to "authenticated";

grant insert on table "public"."sparkloop_offer_events" to "authenticated";

grant references on table "public"."sparkloop_offer_events" to "authenticated";

grant select on table "public"."sparkloop_offer_events" to "authenticated";

grant trigger on table "public"."sparkloop_offer_events" to "authenticated";

grant truncate on table "public"."sparkloop_offer_events" to "authenticated";

grant update on table "public"."sparkloop_offer_events" to "authenticated";

grant delete on table "public"."sparkloop_offer_events" to "service_role";

grant insert on table "public"."sparkloop_offer_events" to "service_role";

grant references on table "public"."sparkloop_offer_events" to "service_role";

grant select on table "public"."sparkloop_offer_events" to "service_role";

grant trigger on table "public"."sparkloop_offer_events" to "service_role";

grant truncate on table "public"."sparkloop_offer_events" to "service_role";

grant update on table "public"."sparkloop_offer_events" to "service_role";

grant delete on table "public"."sparkloop_rec_modules" to "anon";

grant insert on table "public"."sparkloop_rec_modules" to "anon";

grant references on table "public"."sparkloop_rec_modules" to "anon";

grant select on table "public"."sparkloop_rec_modules" to "anon";

grant trigger on table "public"."sparkloop_rec_modules" to "anon";

grant truncate on table "public"."sparkloop_rec_modules" to "anon";

grant update on table "public"."sparkloop_rec_modules" to "anon";

grant delete on table "public"."sparkloop_rec_modules" to "authenticated";

grant insert on table "public"."sparkloop_rec_modules" to "authenticated";

grant references on table "public"."sparkloop_rec_modules" to "authenticated";

grant select on table "public"."sparkloop_rec_modules" to "authenticated";

grant trigger on table "public"."sparkloop_rec_modules" to "authenticated";

grant truncate on table "public"."sparkloop_rec_modules" to "authenticated";

grant update on table "public"."sparkloop_rec_modules" to "authenticated";

grant delete on table "public"."sparkloop_rec_modules" to "service_role";

grant insert on table "public"."sparkloop_rec_modules" to "service_role";

grant references on table "public"."sparkloop_rec_modules" to "service_role";

grant select on table "public"."sparkloop_rec_modules" to "service_role";

grant trigger on table "public"."sparkloop_rec_modules" to "service_role";

grant truncate on table "public"."sparkloop_rec_modules" to "service_role";

grant update on table "public"."sparkloop_rec_modules" to "service_role";

grant delete on table "public"."sparkloop_recommendations" to "anon";

grant insert on table "public"."sparkloop_recommendations" to "anon";

grant references on table "public"."sparkloop_recommendations" to "anon";

grant select on table "public"."sparkloop_recommendations" to "anon";

grant trigger on table "public"."sparkloop_recommendations" to "anon";

grant truncate on table "public"."sparkloop_recommendations" to "anon";

grant update on table "public"."sparkloop_recommendations" to "anon";

grant delete on table "public"."sparkloop_recommendations" to "authenticated";

grant insert on table "public"."sparkloop_recommendations" to "authenticated";

grant references on table "public"."sparkloop_recommendations" to "authenticated";

grant select on table "public"."sparkloop_recommendations" to "authenticated";

grant trigger on table "public"."sparkloop_recommendations" to "authenticated";

grant truncate on table "public"."sparkloop_recommendations" to "authenticated";

grant update on table "public"."sparkloop_recommendations" to "authenticated";

grant delete on table "public"."sparkloop_recommendations" to "service_role";

grant insert on table "public"."sparkloop_recommendations" to "service_role";

grant references on table "public"."sparkloop_recommendations" to "service_role";

grant select on table "public"."sparkloop_recommendations" to "service_role";

grant trigger on table "public"."sparkloop_recommendations" to "service_role";

grant truncate on table "public"."sparkloop_recommendations" to "service_role";

grant update on table "public"."sparkloop_recommendations" to "service_role";

grant delete on table "public"."sparkloop_referrals" to "anon";

grant insert on table "public"."sparkloop_referrals" to "anon";

grant references on table "public"."sparkloop_referrals" to "anon";

grant select on table "public"."sparkloop_referrals" to "anon";

grant trigger on table "public"."sparkloop_referrals" to "anon";

grant truncate on table "public"."sparkloop_referrals" to "anon";

grant update on table "public"."sparkloop_referrals" to "anon";

grant delete on table "public"."sparkloop_referrals" to "authenticated";

grant insert on table "public"."sparkloop_referrals" to "authenticated";

grant references on table "public"."sparkloop_referrals" to "authenticated";

grant select on table "public"."sparkloop_referrals" to "authenticated";

grant trigger on table "public"."sparkloop_referrals" to "authenticated";

grant truncate on table "public"."sparkloop_referrals" to "authenticated";

grant update on table "public"."sparkloop_referrals" to "authenticated";

grant delete on table "public"."sparkloop_referrals" to "service_role";

grant insert on table "public"."sparkloop_referrals" to "service_role";

grant references on table "public"."sparkloop_referrals" to "service_role";

grant select on table "public"."sparkloop_referrals" to "service_role";

grant trigger on table "public"."sparkloop_referrals" to "service_role";

grant truncate on table "public"."sparkloop_referrals" to "service_role";

grant update on table "public"."sparkloop_referrals" to "service_role";

grant delete on table "public"."subscriber_real_click_status" to "anon";

grant insert on table "public"."subscriber_real_click_status" to "anon";

grant references on table "public"."subscriber_real_click_status" to "anon";

grant select on table "public"."subscriber_real_click_status" to "anon";

grant trigger on table "public"."subscriber_real_click_status" to "anon";

grant truncate on table "public"."subscriber_real_click_status" to "anon";

grant update on table "public"."subscriber_real_click_status" to "anon";

grant delete on table "public"."subscriber_real_click_status" to "authenticated";

grant insert on table "public"."subscriber_real_click_status" to "authenticated";

grant references on table "public"."subscriber_real_click_status" to "authenticated";

grant select on table "public"."subscriber_real_click_status" to "authenticated";

grant trigger on table "public"."subscriber_real_click_status" to "authenticated";

grant truncate on table "public"."subscriber_real_click_status" to "authenticated";

grant update on table "public"."subscriber_real_click_status" to "authenticated";

grant delete on table "public"."subscriber_real_click_status" to "service_role";

grant insert on table "public"."subscriber_real_click_status" to "service_role";

grant references on table "public"."subscriber_real_click_status" to "service_role";

grant select on table "public"."subscriber_real_click_status" to "service_role";

grant trigger on table "public"."subscriber_real_click_status" to "service_role";

grant truncate on table "public"."subscriber_real_click_status" to "service_role";

grant update on table "public"."subscriber_real_click_status" to "service_role";

grant delete on table "public"."system_logs" to "anon";

grant insert on table "public"."system_logs" to "anon";

grant references on table "public"."system_logs" to "anon";

grant select on table "public"."system_logs" to "anon";

grant trigger on table "public"."system_logs" to "anon";

grant truncate on table "public"."system_logs" to "anon";

grant update on table "public"."system_logs" to "anon";

grant delete on table "public"."system_logs" to "authenticated";

grant insert on table "public"."system_logs" to "authenticated";

grant references on table "public"."system_logs" to "authenticated";

grant select on table "public"."system_logs" to "authenticated";

grant trigger on table "public"."system_logs" to "authenticated";

grant truncate on table "public"."system_logs" to "authenticated";

grant update on table "public"."system_logs" to "authenticated";

grant delete on table "public"."system_logs" to "service_role";

grant insert on table "public"."system_logs" to "service_role";

grant references on table "public"."system_logs" to "service_role";

grant select on table "public"."system_logs" to "service_role";

grant trigger on table "public"."system_logs" to "service_role";

grant truncate on table "public"."system_logs" to "service_role";

grant update on table "public"."system_logs" to "service_role";

grant delete on table "public"."text_box_blocks" to "anon";

grant insert on table "public"."text_box_blocks" to "anon";

grant references on table "public"."text_box_blocks" to "anon";

grant select on table "public"."text_box_blocks" to "anon";

grant trigger on table "public"."text_box_blocks" to "anon";

grant truncate on table "public"."text_box_blocks" to "anon";

grant update on table "public"."text_box_blocks" to "anon";

grant delete on table "public"."text_box_blocks" to "authenticated";

grant insert on table "public"."text_box_blocks" to "authenticated";

grant references on table "public"."text_box_blocks" to "authenticated";

grant select on table "public"."text_box_blocks" to "authenticated";

grant trigger on table "public"."text_box_blocks" to "authenticated";

grant truncate on table "public"."text_box_blocks" to "authenticated";

grant update on table "public"."text_box_blocks" to "authenticated";

grant delete on table "public"."text_box_blocks" to "service_role";

grant insert on table "public"."text_box_blocks" to "service_role";

grant references on table "public"."text_box_blocks" to "service_role";

grant select on table "public"."text_box_blocks" to "service_role";

grant trigger on table "public"."text_box_blocks" to "service_role";

grant truncate on table "public"."text_box_blocks" to "service_role";

grant update on table "public"."text_box_blocks" to "service_role";

grant delete on table "public"."text_box_modules" to "anon";

grant insert on table "public"."text_box_modules" to "anon";

grant references on table "public"."text_box_modules" to "anon";

grant select on table "public"."text_box_modules" to "anon";

grant trigger on table "public"."text_box_modules" to "anon";

grant truncate on table "public"."text_box_modules" to "anon";

grant update on table "public"."text_box_modules" to "anon";

grant delete on table "public"."text_box_modules" to "authenticated";

grant insert on table "public"."text_box_modules" to "authenticated";

grant references on table "public"."text_box_modules" to "authenticated";

grant select on table "public"."text_box_modules" to "authenticated";

grant trigger on table "public"."text_box_modules" to "authenticated";

grant truncate on table "public"."text_box_modules" to "authenticated";

grant update on table "public"."text_box_modules" to "authenticated";

grant delete on table "public"."text_box_modules" to "service_role";

grant insert on table "public"."text_box_modules" to "service_role";

grant references on table "public"."text_box_modules" to "service_role";

grant select on table "public"."text_box_modules" to "service_role";

grant trigger on table "public"."text_box_modules" to "service_role";

grant truncate on table "public"."text_box_modules" to "service_role";

grant update on table "public"."text_box_modules" to "service_role";

grant delete on table "public"."tool_directory_clicks" to "anon";

grant insert on table "public"."tool_directory_clicks" to "anon";

grant references on table "public"."tool_directory_clicks" to "anon";

grant select on table "public"."tool_directory_clicks" to "anon";

grant trigger on table "public"."tool_directory_clicks" to "anon";

grant truncate on table "public"."tool_directory_clicks" to "anon";

grant update on table "public"."tool_directory_clicks" to "anon";

grant delete on table "public"."tool_directory_clicks" to "authenticated";

grant insert on table "public"."tool_directory_clicks" to "authenticated";

grant references on table "public"."tool_directory_clicks" to "authenticated";

grant select on table "public"."tool_directory_clicks" to "authenticated";

grant trigger on table "public"."tool_directory_clicks" to "authenticated";

grant truncate on table "public"."tool_directory_clicks" to "authenticated";

grant update on table "public"."tool_directory_clicks" to "authenticated";

grant delete on table "public"."tool_directory_clicks" to "service_role";

grant insert on table "public"."tool_directory_clicks" to "service_role";

grant references on table "public"."tool_directory_clicks" to "service_role";

grant select on table "public"."tool_directory_clicks" to "service_role";

grant trigger on table "public"."tool_directory_clicks" to "service_role";

grant truncate on table "public"."tool_directory_clicks" to "service_role";

grant update on table "public"."tool_directory_clicks" to "service_role";

grant delete on table "public"."tools_directory" to "anon";

grant insert on table "public"."tools_directory" to "anon";

grant references on table "public"."tools_directory" to "anon";

grant select on table "public"."tools_directory" to "anon";

grant trigger on table "public"."tools_directory" to "anon";

grant truncate on table "public"."tools_directory" to "anon";

grant update on table "public"."tools_directory" to "anon";

grant delete on table "public"."tools_directory" to "authenticated";

grant insert on table "public"."tools_directory" to "authenticated";

grant references on table "public"."tools_directory" to "authenticated";

grant select on table "public"."tools_directory" to "authenticated";

grant trigger on table "public"."tools_directory" to "authenticated";

grant truncate on table "public"."tools_directory" to "authenticated";

grant update on table "public"."tools_directory" to "authenticated";

grant delete on table "public"."tools_directory" to "service_role";

grant insert on table "public"."tools_directory" to "service_role";

grant references on table "public"."tools_directory" to "service_role";

grant select on table "public"."tools_directory" to "service_role";

grant trigger on table "public"."tools_directory" to "service_role";

grant truncate on table "public"."tools_directory" to "service_role";

grant update on table "public"."tools_directory" to "service_role";

grant delete on table "public"."user_activities" to "anon";

grant insert on table "public"."user_activities" to "anon";

grant references on table "public"."user_activities" to "anon";

grant select on table "public"."user_activities" to "anon";

grant trigger on table "public"."user_activities" to "anon";

grant truncate on table "public"."user_activities" to "anon";

grant update on table "public"."user_activities" to "anon";

grant delete on table "public"."user_activities" to "authenticated";

grant insert on table "public"."user_activities" to "authenticated";

grant references on table "public"."user_activities" to "authenticated";

grant select on table "public"."user_activities" to "authenticated";

grant trigger on table "public"."user_activities" to "authenticated";

grant truncate on table "public"."user_activities" to "authenticated";

grant update on table "public"."user_activities" to "authenticated";

grant delete on table "public"."user_activities" to "service_role";

grant insert on table "public"."user_activities" to "service_role";

grant references on table "public"."user_activities" to "service_role";

grant select on table "public"."user_activities" to "service_role";

grant trigger on table "public"."user_activities" to "service_role";

grant truncate on table "public"."user_activities" to "service_role";

grant update on table "public"."user_activities" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "ai_app_modules_service_role"
  on "public"."ai_app_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Users can delete own prompts"
  on "public"."ai_prompt_tests"
  as permissive
  for delete
  to public
using (true);



  create policy "Users can insert own prompts"
  on "public"."ai_prompt_tests"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can update own prompts"
  on "public"."ai_prompt_tests"
  as permissive
  for update
  to public
using (true);



  create policy "Users can view own prompts"
  on "public"."ai_prompt_tests"
  as permissive
  for select
  to public
using (true);



  create policy "Enable delete for authenticated users"
  on "public"."article_categories"
  as permissive
  for delete
  to public
using (true);



  create policy "Enable insert for authenticated users"
  on "public"."article_categories"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."article_categories"
  as permissive
  for select
  to public
using (true);



  create policy "Enable update for authenticated users"
  on "public"."article_categories"
  as permissive
  for update
  to public
using (true);



  create policy "article_module_criteria_service_role"
  on "public"."article_module_criteria"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "article_module_prompts_service_role"
  on "public"."article_module_prompts"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "article_modules_service_role"
  on "public"."article_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow public read on directory_categories"
  on "public"."directory_categories"
  as permissive
  for select
  to public
using (true);



  create policy "Allow service role all on directory_categories"
  on "public"."directory_categories"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));



  create policy "Allow public read on directory_categories_tools"
  on "public"."directory_categories_tools"
  as permissive
  for select
  to public
using (true);



  create policy "Allow service role all on directory_categories_tools"
  on "public"."directory_categories_tools"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));



  create policy "feedback_blocks_service_role"
  on "public"."feedback_blocks"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role can manage feedback comment read status"
  on "public"."feedback_comment_read_status"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users can manage their own read status"
  on "public"."feedback_comment_read_status"
  as permissive
  for all
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "feedback_comments_service_role"
  on "public"."feedback_comments"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "feedback_modules_service_role"
  on "public"."feedback_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role can manage feedback_responses"
  on "public"."feedback_responses"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "feedback_votes_service_role"
  on "public"."feedback_votes"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "issue_ai_app_modules_service_role"
  on "public"."issue_ai_app_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "issue_article_modules_service_role"
  on "public"."issue_article_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "issue_poll_modules_service_role"
  on "public"."issue_poll_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "issue_prompt_modules_service_role"
  on "public"."issue_prompt_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow service role full access on issue_sparkloop_rec_modules"
  on "public"."issue_sparkloop_rec_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role has full access to issue_text_box_blocks"
  on "public"."issue_text_box_blocks"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role has full access to issue_text_box_modules"
  on "public"."issue_text_box_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Enable delete for authenticated users"
  on "public"."manual_articles"
  as permissive
  for delete
  to public
using (true);



  create policy "Enable insert for authenticated users"
  on "public"."manual_articles"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."manual_articles"
  as permissive
  for select
  to public
using (true);



  create policy "Enable update for authenticated users"
  on "public"."manual_articles"
  as permissive
  for update
  to public
using (true);



  create policy "module_articles_service_role"
  on "public"."module_articles"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "poll_modules_service_role"
  on "public"."poll_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "prompt_modules_service_role"
  on "public"."prompt_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role can manage sparkloop_events"
  on "public"."sparkloop_events"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Service role full access on sparkloop_module_clicks"
  on "public"."sparkloop_module_clicks"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow service role full access on sparkloop_rec_modules"
  on "public"."sparkloop_rec_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role can manage sparkloop_recommendations"
  on "public"."sparkloop_recommendations"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Service role can manage subscriber_real_click_status"
  on "public"."subscriber_real_click_status"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Service role has full access to text_box_blocks"
  on "public"."text_box_blocks"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Service role has full access to text_box_modules"
  on "public"."text_box_modules"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow authenticated insert on tools_directory"
  on "public"."tools_directory"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read on tools_directory"
  on "public"."tools_directory"
  as permissive
  for select
  to public
using (true);



  create policy "Allow service role all on tools_directory"
  on "public"."tools_directory"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));


CREATE TRIGGER set_ai_app_modules_updated_at BEFORE UPDATE ON public.ai_app_modules FOR EACH ROW EXECUTE FUNCTION public.update_ai_app_modules_updated_at();

CREATE TRIGGER set_article_module_criteria_updated_at BEFORE UPDATE ON public.article_module_criteria FOR EACH ROW EXECUTE FUNCTION public.update_article_module_criteria_updated_at();

CREATE TRIGGER set_article_module_prompts_updated_at BEFORE UPDATE ON public.article_module_prompts FOR EACH ROW EXECUTE FUNCTION public.update_article_module_prompts_updated_at();

CREATE TRIGGER set_article_modules_updated_at BEFORE UPDATE ON public.article_modules FOR EACH ROW EXECUTE FUNCTION public.update_article_modules_updated_at();

CREATE TRIGGER directory_categories_updated_at BEFORE UPDATE ON public.directory_categories FOR EACH ROW EXECUTE FUNCTION public.update_directory_updated_at();

CREATE TRIGGER set_feedback_blocks_updated_at BEFORE UPDATE ON public.feedback_blocks FOR EACH ROW EXECUTE FUNCTION public.update_feedback_blocks_updated_at();

CREATE TRIGGER set_feedback_modules_updated_at BEFORE UPDATE ON public.feedback_modules FOR EACH ROW EXECUTE FUNCTION public.update_feedback_modules_updated_at();

CREATE TRIGGER issue_text_box_blocks_updated_at BEFORE UPDATE ON public.issue_text_box_blocks FOR EACH ROW EXECUTE FUNCTION public.update_text_box_updated_at();

CREATE TRIGGER issue_text_box_modules_updated_at BEFORE UPDATE ON public.issue_text_box_modules FOR EACH ROW EXECUTE FUNCTION public.update_text_box_updated_at();

CREATE TRIGGER set_module_articles_updated_at BEFORE UPDATE ON public.module_articles FOR EACH ROW EXECUTE FUNCTION public.update_module_articles_updated_at();

CREATE TRIGGER set_poll_modules_updated_at BEFORE UPDATE ON public.poll_modules FOR EACH ROW EXECUTE FUNCTION public.update_poll_modules_updated_at();

CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_prompt_modules_updated_at BEFORE UPDATE ON public.prompt_modules FOR EACH ROW EXECUTE FUNCTION public.update_prompt_modules_updated_at();

CREATE TRIGGER update_secondary_articles_updated_at BEFORE UPDATE ON public.secondary_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_sparkloop_rec_modules_updated_at BEFORE UPDATE ON public.sparkloop_rec_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_sparkloop_rates BEFORE UPDATE ON public.sparkloop_recommendations FOR EACH ROW WHEN (((old.impressions IS DISTINCT FROM new.impressions) OR (old.submissions IS DISTINCT FROM new.submissions) OR (old.our_confirms IS DISTINCT FROM new.our_confirms) OR (old.our_rejections IS DISTINCT FROM new.our_rejections))) EXECUTE FUNCTION public.update_sparkloop_rates();

CREATE TRIGGER text_box_blocks_updated_at BEFORE UPDATE ON public.text_box_blocks FOR EACH ROW EXECUTE FUNCTION public.update_text_box_updated_at();

CREATE TRIGGER text_box_modules_updated_at BEFORE UPDATE ON public.text_box_modules FOR EACH ROW EXECUTE FUNCTION public.update_text_box_updated_at();

CREATE TRIGGER tools_directory_updated_at BEFORE UPDATE ON public.tools_directory FOR EACH ROW EXECUTE FUNCTION public.update_directory_updated_at();


  create policy "Authenticated users can update ad images"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'ad-images'::text));



  create policy "Authenticated users can upload ad images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'ad-images'::text));



  create policy "Public read access for ad images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'ad-images'::text));



