import { Controller, Get, Param } from '@nestjs/common';
import { AddressService } from './address.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get('provinces')
  getProvinces() {
    return this.addressService.getProvinces();
  }

  @Get('districts/:provinceCode')
  getDistricts(@Param('provinceCode') provinceCode: string) {
    return this.addressService.getDistricts(provinceCode);
  }

  @Get('wards/:districtCode')
  getWards(@Param('districtCode') districtCode: string) {
    return this.addressService.getWards(districtCode);
  }
}
