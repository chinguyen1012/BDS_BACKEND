import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AddressService {
  private readonly baseUrl = 'https://provinces.open-api.vn/api/v2';

  constructor(private readonly httpService: HttpService) {}

  async getProvinces() {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/p`),
    );

    return data;
  }

  async getDistricts(provinceCode: string) {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/p/${provinceCode}?depth=2`),
    );

    return data.districts || [];
  }

  async getWards(districtCode: string) {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/d/${districtCode}?depth=2`),
    );

    return data.wards || [];
  }
}
