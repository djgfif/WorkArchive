import { Controller, Get, Headers, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ImageProxyService } from './image-proxy.service';

@Controller('image-proxy')
export class ImageProxyController {
  constructor(
    @Inject(ImageProxyService)
    private readonly imageProxyService: ImageProxyService,
  ) {}

  @Get()
  async proxyImage(
    @Query('url') url: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const image = await this.imageProxyService.getImage(url);
    const matchesEtag = ifNoneMatch
      ?.split(',')
      .map((value) => value.trim())
      .includes(image.etag);

    if (matchesEtag) {
      res
        .status(304)
        .set({
          'Cache-Control': image.cacheControl,
          ETag: image.etag,
          'X-Content-Type-Options': 'nosniff',
        })
        .send();

      return;
    }

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
