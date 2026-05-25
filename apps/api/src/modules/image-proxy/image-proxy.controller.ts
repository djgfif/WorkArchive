import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ImageProxyService } from './image-proxy.service';

@Controller('image-proxy')
export class ImageProxyController {
  constructor(
    @Inject(ImageProxyService)
    private readonly imageProxyService: ImageProxyService,
  ) {}

  @Get()
  async proxyImage(@Query('url') url: string | undefined, @Res() res: Response) {
    const image = await this.imageProxyService.getImage(url);

    res
      .status(200)
      .set({
        'Cache-Control': image.cacheControl,
        'Content-Length': image.body.byteLength.toString(),
        'Content-Type': image.contentType,
        ETag: image.etag,
        'X-Content-Type-Options': 'nosniff',
      })
      .send(image.body);
  }
}
