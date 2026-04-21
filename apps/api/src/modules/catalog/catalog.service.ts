import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(
    data: Prisma.CatalogWorkUncheckedCreateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.catalogWork.create({
      data,
    });
  }

  update(
    id: string,
    data: Prisma.CatalogWorkUpdateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.catalogWork.update({
      where: {
        id,
      },
      data,
    });
  }
}
