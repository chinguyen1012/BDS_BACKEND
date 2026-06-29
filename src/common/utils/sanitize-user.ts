import { UserDocument } from '../../modules/users/schemas/user.schema';

export function sanitizeUser(user: UserDocument) {
  const obj = user.toObject();
  delete obj.password;
  return obj;
}
