import type { Pipeline, PipelineEdge } from "./schema"

/**
 * Graph-theory utilities for the pipeline DAG.
 *
 * Cycle prevention is enforced in THREE layers:
 *   1. Edit-time  — `wouldCreateCycle` rejects an edge before it is added (UX).
 *   2. Save-time  — `assertAcyclic` (Kahn) is the authoritative server guard.
 *   3. Execute    — `toExecutionWaves` throws on any residual cycle.
 */

export class CyclicPipelineError extends Error {
  constructor(public readonly members: string[]) {
    super(`Pipeline contains a cycle involving: ${members.join(", ")}`)
    this.name = "CyclicPipelineError"
  }
}

function buildAdjacency(edges: Pick<PipelineEdge, "source" | "target">[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    adj.get(e.source)!.push(e.target)
  }
  return adj
}

/**
 * Edit-time guard: returns true if adding source→target would close a cycle,
 * i.e. if `target` can already reach `source`. O(V + E) DFS.
 */
export function wouldCreateCycle(
  edges: Pick<PipelineEdge, "source" | "target">[],
  source: string,
  target: string
): boolean {
  if (source === target) return true
  const adj = buildAdjacency(edges)
  const stack = [target]
  const seen = new Set<string>()
  while (stack.length) {
    const n = stack.pop()!
    if (n === source) return true
    if (seen.has(n)) continue
    seen.add(n)
    for (const m of adj.get(n) ?? []) stack.push(m)
  }
  return false
}

/**
 * Kahn's algorithm. Returns nodes grouped into dependency "waves": every node in
 * a wave has no unmet dependency, so a wave is safe to execute in PARALLEL;
 * waves run sequentially. Throws `CyclicPipelineError` if the graph is cyclic.
 */
export function toExecutionWaves(pipeline: Pipeline): string[][] {
  const indeg = new Map<string, number>(pipeline.nodes.map((n) => [n.id, 0]))
  const adj = new Map<string, string[]>(pipeline.nodes.map((n) => [n.id, []]))

  for (const e of pipeline.edges) {
    if (!indeg.has(e.target) || !adj.has(e.source)) continue // ignore dangling edges
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
    adj.get(e.source)!.push(e.target)
  }

  const waves: string[][] = []
  let frontier = [...indeg].filter(([, d]) => d === 0).map(([id]) => id)
  let processed = 0

  while (frontier.length) {
    waves.push(frontier)
    const next: string[] = []
    for (const id of frontier) {
      processed++
      for (const m of adj.get(id) ?? []) {
        indeg.set(m, (indeg.get(m) ?? 0) - 1)
        if (indeg.get(m) === 0) next.push(m)
      }
    }
    frontier = next
  }

  if (processed !== pipeline.nodes.length) {
    const members = [...indeg].filter(([, d]) => d > 0).map(([id]) => id)
    throw new CyclicPipelineError(members)
  }
  return waves
}

/** Save-time authoritative guard. */
export function assertAcyclic(pipeline: Pipeline): void {
  toExecutionWaves(pipeline)
}
