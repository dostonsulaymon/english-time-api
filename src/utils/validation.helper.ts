import { ObjectId } from 'mongodb';

export class ValidationHelper {
  static isValidObjectId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }

    return ObjectId.isValid(id);
  }
}
