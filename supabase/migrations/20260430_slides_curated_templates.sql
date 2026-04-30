-- Seed 4 curated templates. Each row's design_spec is a JSON blob the deck
-- renderer composes into Claude's prompt. Fonts/colors/vibe drive output.
--
-- ON CONFLICT clause keeps re-runs idempotent (slug is unique with null org).

insert into slides.templates (id, slug, name, kind, design_spec, org_id, preview_path)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'birdie-editorial-dark',
    'Birdie Editorial Dark',
    'curated',
    jsonb_build_object(
      'name', 'Birdie Editorial Dark',
      'vibe', 'Cinematic, immersive dark mode. Editorial typography. Gradient accents and full-bleed hero sections.',
      'colors', jsonb_build_object(
        'bg_primary',       '#0a0a0f',
        'bg_secondary',     '#0f0f1a',
        'bg_tertiary',      '#161625',
        'text_primary',     '#f1f5f9',
        'text_secondary',   '#94a3b8',
        'text_muted',       '#64748b',
        'accent_primary',   '#818cf8',
        'accent_secondary', '#f59e0b',
        'accent_gradient',  'linear-gradient(135deg, #818cf8, #c084fc)'
      ),
      'fonts', jsonb_build_object(
        'heading', 'Playfair Display',
        'body',    'Inter',
        'weights_heading', '400;600;700;800',
        'weights_body',    '300;400;500;600;700'
      ),
      'layout_bias', jsonb_build_array(
        'hero with full-bleed gradient',
        'stats with animated counters',
        'alternating dark/secondary section backgrounds'
      )
    ),
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'birdie-modern-light',
    'Birdie Modern Light',
    'curated',
    jsonb_build_object(
      'name', 'Birdie Modern Light',
      'vibe', 'Bright, BAF brand palette. Magenta primary on white/cream. Friendly, modern, energetic.',
      'colors', jsonb_build_object(
        'bg_primary',       '#FFFFFF',
        'bg_secondary',     '#FFF5FB',
        'bg_tertiary',      '#FDECF8',
        'text_primary',     '#380527',
        'text_secondary',   '#510742',
        'text_muted',       '#7a4f6c',
        'accent_primary',   '#C72886',
        'accent_secondary', '#510742',
        'accent_gradient',  'linear-gradient(135deg, #C72886, #510742)'
      ),
      'fonts', jsonb_build_object(
        'heading', 'Montserrat',
        'body',    'Montserrat',
        'weights_heading', '700;800',
        'weights_body',    '300;400;500;600'
      ),
      'layout_bias', jsonb_build_array(
        'clean light hero',
        'magenta CTA buttons',
        'pink-tinted card sections',
        'rounded corners 16px+, generous padding'
      )
    ),
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'investor-pitch',
    'Investor Pitch',
    'curated',
    jsonb_build_object(
      'name', 'Investor Pitch',
      'vibe', 'Sober, quantitative, lots of whitespace. Big stat blocks. Serif headings. Black-and-white restraint.',
      'colors', jsonb_build_object(
        'bg_primary',       '#FFFFFF',
        'bg_secondary',     '#F8F8F6',
        'bg_tertiary',      '#EFEFEC',
        'text_primary',     '#111111',
        'text_secondary',   '#444444',
        'text_muted',       '#7a7a7a',
        'accent_primary',   '#000000',
        'accent_secondary', '#444444',
        'accent_gradient',  'none'
      ),
      'fonts', jsonb_build_object(
        'heading', 'Playfair Display',
        'body',    'Inter',
        'weights_heading', '400;700',
        'weights_body',    '300;400;600'
      ),
      'layout_bias', jsonb_build_array(
        'minimal hero, single line',
        'big numbered stats with thin labels',
        'two-column quote + attribution',
        'lots of vertical whitespace, no gradients'
      )
    ),
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'sales-deck',
    'Sales Deck',
    'curated',
    jsonb_build_object(
      'name', 'Sales Deck',
      'vibe', 'Punchy, persuasive. Magenta CTAs. Comparison + timeline biased. Confident copy.',
      'colors', jsonb_build_object(
        'bg_primary',       '#FFFFFF',
        'bg_secondary',     '#0F0F0F',
        'bg_tertiary',      '#FDECF8',
        'text_primary',     '#0F0F0F',
        'text_secondary',   '#444444',
        'text_muted',       '#7a7a7a',
        'accent_primary',   '#C72886',
        'accent_secondary', '#510742',
        'accent_gradient',  'linear-gradient(135deg, #C72886, #FF5BA8)'
      ),
      'fonts', jsonb_build_object(
        'heading', 'Inter',
        'body',    'Inter',
        'weights_heading', '700;800;900',
        'weights_body',    '400;500;600'
      ),
      'layout_bias', jsonb_build_array(
        'bold hero with magenta CTA button',
        'two-column comparison (vs / before-after)',
        'timeline 3-step',
        'stats with animated counters',
        'closing CTA full-bleed magenta'
      )
    ),
    null,
    null
  )
on conflict (id) do update
  set name = excluded.name,
      design_spec = excluded.design_spec;
