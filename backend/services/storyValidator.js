import Ajv from 'ajv';
import { chunkResultSchema } from '../schemas/chunkSchema.js';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateChunkResult = ajv.compile(chunkResultSchema);

export function validateStoryResult(result) {
  if (!validateChunkResult(result)) {
    const details = formatAjvErrors(validateChunkResult.errors);
    const error = new Error(`AI 返回结构不符合要求：${details}`);
    error.status = 500;
    error.details = validateChunkResult.errors;
    throw error;
  }

  return true;
}

export function formatAjvErrors(errors = []) {
  return errors
    .map((error) => {
      const path = error.instancePath || '/';
      return `${path} ${error.message}`;
    })
    .join('; ');
}
