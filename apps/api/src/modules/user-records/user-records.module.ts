import { Module } from '@nestjs/common';

import { UserRecordsService } from './user-records.service';

@Module({
  providers: [UserRecordsService],
  exports: [UserRecordsService],
})
export class UserRecordsModule {}
