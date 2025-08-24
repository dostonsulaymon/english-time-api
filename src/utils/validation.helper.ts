import { validate as uuidValidate, version as uuidVersion } from 'uuid';

export class ValidationHelper {
  static isValidObjectId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return uuidValidate(id) && uuidVersion(id) === 4;
  }
}
