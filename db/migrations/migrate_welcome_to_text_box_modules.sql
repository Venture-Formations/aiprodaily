-- Migration: Convert existing Welcome Section data to Text Box Modules
-- This migration should be run AFTER create_text_box_modules_system.sql
-- and AFTER the system has been tested

-- Step 1: Create a "Welcome" Text Box Module for each publication
-- Note: show_name = false for Welcome sections (they don't show headers)
-- Using display_order = 1 to position at the top

DO $$
DECLARE
    pub RECORD;
    new_module_id UUID;
    existing_module_id UUID;
BEGIN
    FOR pub IN SELECT id, name FROM publications
    LOOP
        -- Check if a Welcome module already exists for this publication
        SELECT id INTO existing_module_id
        FROM text_box_modules
        WHERE publication_id = pub.id AND name = 'Welcome'
        LIMIT 1;

        IF existing_module_id IS NULL THEN
            -- Create the Welcome text box module
            INSERT INTO text_box_modules (
                publication_id,
                name,
                display_order,
                is_active,
                show_name,
                config
            ) VALUES (
                pub.id,
                'Welcome',
                1,  -- Position at top
                true,
                false,  -- Don't show section header for Welcome
                '{}'::jsonb
            )
            RETURNING id INTO new_module_id;

            RAISE NOTICE 'Created Welcome module % for publication %', new_module_id, pub.name;

            -- Create an AI Prompt block for the welcome text
            -- This will use the existing welcome prompt from publication_settings
            INSERT INTO text_box_blocks (
                text_box_module_id,
                block_type,
                display_order,
                ai_prompt_json,
                generation_timing,
                is_active
            ) VALUES (
                new_module_id,
                'ai_prompt',
                0,
                jsonb_build_object(
                    'prompt', 'You are a friendly AI assistant writing a welcome message for a newsletter. The newsletter is about AI in accounting and finance. Write a warm, engaging welcome that introduces the day''s content and sets an enthusiastic but professional tone. Keep it to 2-3 sentences.',
                    'model', 'gpt-4o-mini',
                    'max_tokens', 200,
                    'temperature', 0.7
                ),
                'after_articles',  -- Generate after articles are selected for full context
                true
            );

            RAISE NOTICE 'Created AI prompt block for Welcome module %', new_module_id;
        ELSE
            RAISE NOTICE 'Welcome module already exists for publication %', pub.name;
        END IF;
    END LOOP;
END;
$$;

-- Step 2: Migrate existing welcome content from sent issues to issue_text_box_blocks
-- This preserves historical data for archive pages

-- Note: This step is OPTIONAL and depends on your data model
-- If you have welcome_intro, welcome_tagline, welcome_summary columns in publication_issues,
-- uncomment and modify the following:

/*
DO $$
DECLARE
    iss RECORD;
    module_id UUID;
    block_id UUID;
BEGIN
    FOR iss IN
        SELECT pi.id as issue_id, pi.publication_id, pi.welcome_intro, pi.welcome_summary
        FROM publication_issues pi
        WHERE pi.status = 'sent'
        AND (pi.welcome_intro IS NOT NULL OR pi.welcome_summary IS NOT NULL)
    LOOP
        -- Get the Welcome module for this publication
        SELECT tbm.id INTO module_id
        FROM text_box_modules tbm
        WHERE tbm.publication_id = iss.publication_id
        AND tbm.name = 'Welcome'
        LIMIT 1;

        IF module_id IS NOT NULL THEN
            -- Get the first AI prompt block
            SELECT tbb.id INTO block_id
            FROM text_box_blocks tbb
            WHERE tbb.text_box_module_id = module_id
            AND tbb.block_type = 'ai_prompt'
            ORDER BY tbb.display_order
            LIMIT 1;

            IF block_id IS NOT NULL THEN
                -- Check if issue_text_box_modules record exists
                INSERT INTO issue_text_box_modules (issue_id, text_box_module_id)
                VALUES (iss.issue_id, module_id)
                ON CONFLICT (issue_id, text_box_module_id) DO NOTHING;

                -- Create or update issue block record with existing content
                INSERT INTO issue_text_box_blocks (
                    issue_id,
                    text_box_block_id,
                    generated_content,
                    generation_status,
                    generated_at
                ) VALUES (
                    iss.issue_id,
                    block_id,
                    COALESCE(iss.welcome_intro, '') || E'\n\n' || COALESCE(iss.welcome_summary, ''),
                    'completed',
                    NOW()
                )
                ON CONFLICT (issue_id, text_box_block_id) DO UPDATE
                SET generated_content = EXCLUDED.generated_content,
                    generation_status = 'completed';

                RAISE NOTICE 'Migrated welcome content for issue %', iss.issue_id;
            END IF;
        END IF;
    END LOOP;
END;
$$;
*/

-- Step 3: Add the Welcome module to newsletter_sections for ordering
-- This integrates it with the existing section ordering system

DO $$
DECLARE
    pub RECORD;
    module_id UUID;
BEGIN
    FOR pub IN SELECT id FROM publications
    LOOP
        -- Get the Welcome module ID
        SELECT id INTO module_id
        FROM text_box_modules
        WHERE publication_id = pub.id AND name = 'Welcome'
        LIMIT 1;

        IF module_id IS NOT NULL THEN
            -- Insert into newsletter_sections if not exists
            -- Using section_type = 'text_box_module' and the module ID
            INSERT INTO newsletter_sections (
                publication_id,
                name,
                section_type,
                display_order,
                is_active,
                config
            ) VALUES (
                pub.id,
                'Welcome',
                'text_box_module',
                1,
                true,
                jsonb_build_object('module_id', module_id)
            )
            ON CONFLICT DO NOTHING;

            RAISE NOTICE 'Added Welcome to newsletter_sections for publication %', pub.id;
        END IF;
    END LOOP;
END;
$$;

-- Verification queries (uncomment to run)
/*
-- Check text_box_modules created
SELECT p.name as publication, tbm.name as module_name, tbm.show_name, tbm.is_active
FROM text_box_modules tbm
JOIN publications p ON p.id = tbm.publication_id
WHERE tbm.name = 'Welcome';

-- Check blocks created
SELECT p.name as publication, tbm.name as module_name, tbb.block_type, tbb.generation_timing
FROM text_box_blocks tbb
JOIN text_box_modules tbm ON tbm.id = tbb.text_box_module_id
JOIN publications p ON p.id = tbm.publication_id
WHERE tbm.name = 'Welcome';

-- Check newsletter_sections integration
SELECT ns.name, ns.section_type, ns.display_order, ns.config
FROM newsletter_sections ns
WHERE ns.section_type = 'text_box_module';
*/

COMMENT ON TABLE text_box_modules IS 'Text box modules created from migrate_welcome_to_text_box_modules.sql';
