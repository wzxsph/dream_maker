export const chunkResultSchema = {
  type: 'object',
  required: ['state_patch', 'chunk'],
  additionalProperties: true,
  properties: {
    state_patch: {
      type: 'object',
      required: [
        'current_phase',
        'facts_add',
        'open_threads_add',
        'open_threads_resolved',
        'characters_update'
      ],
      additionalProperties: true,
      properties: {
        current_phase: { type: 'string' },
        facts_add: { type: 'array', items: { type: 'string' } },
        open_threads_add: { type: 'array', items: { type: 'string' } },
        open_threads_resolved: { type: 'array', items: { type: 'string' } },
        characters_update: {
          type: 'array',
          items: { type: 'object', additionalProperties: true }
        }
      }
    },
    chunk: {
      type: 'object',
      required: ['chunk_id', 'chunk_index', 'type', 'start_node', 'end_nodes', 'nodes'],
      additionalProperties: true,
      properties: {
        chunk_id: { type: 'string' },
        chunk_index: { type: 'number' },
        type: { type: 'string', enum: ['opening', 'middle', 'climax', 'ending'] },
        start_node: { type: 'string' },
        end_nodes: { type: 'array', items: { type: 'string' } },
        nodes: {
          type: 'object',
          minProperties: 1,
          additionalProperties: {
            type: 'object',
            required: ['node_id', 'text', 'bg_theme', 'ui_effect', 'choices'],
            additionalProperties: true,
            properties: {
              node_id: { type: 'string' },
              text: { type: 'string' },
              bg_theme: { type: 'string', enum: ['light', 'dark', 'danger', 'victory'] },
              ui_effect: { type: 'array', items: { type: 'string' } },
              is_paywall: { type: 'boolean' },
              paywall_type: { type: ['string', 'null'] },
              ad_config: { type: ['object', 'null'], additionalProperties: true },
              is_rewrite_point: { type: 'boolean' },
              choices: {
                type: 'array',
                maxItems: 2,
                items: {
                  type: 'object',
                  required: ['content', 'next_node'],
                  additionalProperties: true,
                  properties: {
                    content: { type: 'string' },
                    next_node: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
