import { Controller, Get } from '@nestjs/common';
import type { ProductReleaseRuntime } from '@work-archive/shared-types';

import { getProductReleaseRuntime } from '../../config/product-release-profile';

@Controller('product-release')
export class ProductReleaseController {
  @Get()
  getProductRelease(): ProductReleaseRuntime {
    return getProductReleaseRuntime();
  }
}
