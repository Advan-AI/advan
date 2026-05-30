import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { PIIMasker } from '@/lib/governance/pii-masker';
import { PolicyClient } from '@/lib/governance/policy-client';

/**
 * Advan AI Governance Router (Layer 2 -> Layer 3 bridge)
 */
export const governanceRouter = router({
  maskPII: protectedProcedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      const masked = PIIMasker.mask(input.text);
      return { masked };
    }),

  checkPolicy: protectedProcedure
    .input(z.object({ 
      policyPath: z.string(),
      context: z.any() 
    }))
    .query(async ({ input }) => {
      const decision = await PolicyClient.evaluate(input.policyPath, input.context);
      return decision;
    }),
});
