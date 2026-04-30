-- Re-seed curated templates aligned to the BirdsAtFive design system
-- (birdie-redesign/design-catalog.html). Primary pink #F58ED3, deep
-- purple #380527, Rubik throughout. Dark mode tokens taken from .dark
-- root in the catalog.

update slides.templates set
  design_spec = jsonb_build_object(
    'name', 'Birdie Editorial Dark',
    'vibe', 'Cinematic dark mode in BAF brand. Pink + deep-purple gradient accents on near-black background. Editorial weight via Rubik.',
    'colors', jsonb_build_object(
      'bg_primary',       '#0F0D10',
      'bg_secondary',     '#1A1618',
      'bg_tertiary',      '#2D1F28',
      'text_primary',     '#E8D5E0',
      'text_secondary',   'rgba(232,213,224,0.7)',
      'text_muted',       'rgba(232,213,224,0.45)',
      'accent_primary',   '#F58ED3',
      'accent_secondary', '#D159A3',
      'accent_gradient',  'linear-gradient(135deg, #F58ED3, #D159A3)'
    ),
    'fonts', jsonb_build_object(
      'heading', 'Rubik',
      'body',    'Rubik',
      'weights_heading', '500;600;700',
      'weights_body',    '300;400;500;600'
    ),
    'layout_bias', jsonb_build_array(
      'hero with full-bleed pink-to-magenta gradient',
      'stats with animated counters in #F58ED3',
      'alternating dark/secondary section backgrounds',
      'rounded corners 16px, subtle shadow on cards'
    )
  )
where id = '00000000-0000-0000-0000-000000000001';

update slides.templates set
  design_spec = jsonb_build_object(
    'name', 'Birdie Modern Light',
    'vibe', 'Bright BAF light theme. Pink #F58ED3 primary on warm white #F5F5F5 / card #FFFFFF. Deep purple #380527 for headings.',
    'colors', jsonb_build_object(
      'bg_primary',       '#F5F5F5',
      'bg_secondary',     '#FFFFFF',
      'bg_tertiary',      '#FDECF8',
      'text_primary',     '#380527',
      'text_secondary',   '#5e0842',
      'text_muted',       'rgba(56,5,39,0.5)',
      'accent_primary',   '#F58ED3',
      'accent_secondary', '#A33278',
      'accent_gradient',  'linear-gradient(135deg, #F58ED3, #A33278)'
    ),
    'fonts', jsonb_build_object(
      'heading', 'Rubik',
      'body',    'Rubik',
      'weights_heading', '600;700',
      'weights_body',    '300;400;500;600'
    ),
    'layout_bias', jsonb_build_array(
      'clean light hero with deep-purple heading',
      'pink CTA buttons (rounded 10px)',
      'pink-tinted card sections with 16px corners and panel-card shadow',
      'thin 1px borders in #D9D9D9 for divisions'
    )
  )
where id = '00000000-0000-0000-0000-000000000002';

update slides.templates set
  design_spec = jsonb_build_object(
    'name', 'Investor Pitch',
    'vibe', 'Sober, quantitative, lots of whitespace. Big stat blocks. Restrained black on warm white; one quiet pink accent (#F58ED3) for emphasis only.',
    'colors', jsonb_build_object(
      'bg_primary',       '#FFFFFF',
      'bg_secondary',     '#F8F8F6',
      'bg_tertiary',      '#EFEFEC',
      'text_primary',     '#380527',
      'text_secondary',   '#444444',
      'text_muted',       '#7a7a7a',
      'accent_primary',   '#F58ED3',
      'accent_secondary', '#380527',
      'accent_gradient',  'none'
    ),
    'fonts', jsonb_build_object(
      'heading', 'Rubik',
      'body',    'Rubik',
      'weights_heading', '500;700',
      'weights_body',    '300;400;500'
    ),
    'layout_bias', jsonb_build_array(
      'minimal hero, single line of heading',
      'big numbered stats with thin labels',
      'two-column quote + attribution',
      'lots of vertical whitespace, no gradients except for emphasis on a hero KPI'
    )
  )
where id = '00000000-0000-0000-0000-000000000003';

update slides.templates set
  design_spec = jsonb_build_object(
    'name', 'Sales Deck',
    'vibe', 'Punchy, persuasive BAF brand. Pink #F58ED3 CTAs over white; one bold dark statement section in deep-purple #380527. Comparison + timeline biased.',
    'colors', jsonb_build_object(
      'bg_primary',       '#FFFFFF',
      'bg_secondary',     '#380527',
      'bg_tertiary',      '#FDECF8',
      'text_primary',     '#380527',
      'text_secondary',   '#5e0842',
      'text_muted',       'rgba(56,5,39,0.55)',
      'accent_primary',   '#F58ED3',
      'accent_secondary', '#A33278',
      'accent_gradient',  'linear-gradient(135deg, #F58ED3, #D159A3)'
    ),
    'fonts', jsonb_build_object(
      'heading', 'Rubik',
      'body',    'Rubik',
      'weights_heading', '700;800',
      'weights_body',    '400;500;600'
    ),
    'layout_bias', jsonb_build_array(
      'bold hero on white with pink CTA button',
      'two-column comparison (vs / before-after) on light',
      'one dark deep-purple full-bleed statement section',
      'timeline 3-step',
      'stats with animated counters in pink',
      'closing CTA on pink gradient'
    )
  )
where id = '00000000-0000-0000-0000-000000000004';
