import type { MeasureContext, WorkspaceIdWithUrl } from '@hcengineering/core'
import type { FindMessagesParams, Message } from '@hcengineering/communication-types'
import { createDbAdapter } from '@hcengineering/communication-cockroach'
import type { DbAdapter, Event } from '@hcengineering/communication-sdk-types'
import { EventProcessor, type Result } from './eventProcessor.ts'
import { Manager } from './manager.ts'
import type { ConnectionInfo } from './types.ts'

type PipelineContext = {
  workspace: string
}

export type PipelineFactory = (ctx: MeasureContext, ws: WorkspaceIdWithUrl) => Promise<Pipeline | undefined>

export function createServerPipeline(metrics: MeasureContext, dbUrl: string): PipelineFactory {
  return async (ctx, workspace) => {
    if (workspace.uuid === undefined) {
      ctx.error('Workspace uuid not specified, cannot create communication pipeline', workspace)
      return undefined
    }
    const wsMetrics = metrics.newChild('💬communication session', {})
    const context: PipelineContext = {
      workspace: workspace.uuid
    }
    return createPipeline(wsMetrics, context, dbUrl)
  }
}

export async function createPipeline(ctx: MeasureContext, context: PipelineContext, dbUrl: string): Promise<Pipeline> {
  return await Pipeline.create(ctx.newChild('communication pipeline', {}), context, dbUrl)
}

class Pipeline {
  private readonly eventProcessor: EventProcessor
  private readonly manager: Manager
  private constructor(
    readonly ctx: MeasureContext,
    readonly context: PipelineContext,
    private readonly db: DbAdapter
  ) {
    this.eventProcessor = new EventProcessor(db, context.workspace)
    this.manager = new Manager(db, context.workspace)
  }

  static async create(ctx: MeasureContext, context: PipelineContext, dbUrl: string): Promise<Pipeline> {
    const db = await createDbAdapter(dbUrl)
    return new Pipeline(ctx, context, db)
  }

  async findMessages(info: ConnectionInfo, params: FindMessagesParams, queryId?: number): Promise<Message[]> {
    const result = await this.db.findMessages(this.context.workspace, params)
    if (queryId != null && info.sessionId != null && info.sessionId !== '') {
      this.manager.subscribeQuery(info, 'message', queryId, params)
    }
    return result
  }

  async unsubscribeQuery(info: ConnectionInfo, id: number): Promise<void> {
    this.manager.unsubscribeQuery(info, id)
  }

  async event(ctx: MeasureContext, info: ConnectionInfo, personalWorkspace: string, event: Event): Promise<Result> {
    return await this.eventProcessor.process(info.personalWorkspace, event)
    // const { result, broadcastEvent } = await this.eventProcessor.process(personalWorkspace, event)
    // if (broadcastEvent !== undefined) {
    //     void this.manager.next(broadcastEvent)
    // }
    // return result
  }
  //
  // async broadcastEvent (ctx: MeasureContext, personalWorkspace: string, event: BroadcastEvent): Promise<void> {
  //     void this.manager.next(event, personalWorkspace)
  // }

  async close(): Promise<void> {}
}
