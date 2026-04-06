import { prisma } from '@/shared/lib/prisma'
import { Workspace } from '@prisma/client'

export class ChatService {
  static async createChat(userId: string, workspace: Workspace, modelId: string, title: string) {
    return await prisma.chat.create({
      data: {
        userId,
        workspace,
        modelId,
        title,
      }
    })
  }

  static async addMessage(chatId: string, role: string, content: string, modelId: string, mediaUrl?: string) {
    return await prisma.message.create({
      data: {
        chatId,
        role,
        content,
        modelId,
        mediaUrl
      }
    })
  }

  static async getUserChats(userId: string, workspace: Workspace) {
    return await prisma.chat.findMany({
      where: { userId, workspace },
      orderBy: { updatedAt: 'desc' },
      include: { messages: true }
    })
  }
}
