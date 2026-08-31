import { Module } from '@nestjs/common';

import { ProductReleaseController } from './product-release.controller';

@Module({
  controllers: [ProductReleaseController],
})
export class ProductReleaseModule {}
