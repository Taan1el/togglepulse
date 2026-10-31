import type { EvaluationContext, EvaluationResult } from './types';
export function evaluate(file: unknown, flagKey: string, environment: string, context: EvaluationContext): Promise<Omit<EvaluationResult, 'evaluatedAt'>>;
