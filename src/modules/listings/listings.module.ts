import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ListingsController } from './listings.controller';
import { PublicListingsController } from './public-listings.controller';
import { ListingsService } from './listings.service';
import { Listing, ListingSchema } from './schemas/listing.schema';
import { OrgMembershipsModule } from '../org-memberships/org-memberships.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]),
    OrgMembershipsModule,
  ],
  controllers: [ListingsController, PublicListingsController],
  providers: [ListingsService],
  exports: [ListingsService, MongooseModule],
})
export class ListingsModule {}
