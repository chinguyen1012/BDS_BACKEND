import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  permissions?: string[];
}
