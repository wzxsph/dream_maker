export const storySessionSchema = {
  type: 'object',
  required: [
    'story_id',
    'title',
    'status',
    'max_chunks',
    'current_chunk_index',
    'story_state',
    'chunks',
    'node_index',
    'player_path',
    'interventions',
    'created_at',
    'updated_at'
  ],
  additionalProperties: true
};
