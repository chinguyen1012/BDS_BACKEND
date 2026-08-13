import { IsEmail, IsMongoId } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsMongoId()
  roleId: string;
}
