import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { ProjectStatus } from '../../../common/enums/project.enums';

export class QueryPublicProjectDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  developer?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit?: number;
}
