import { ObjectId } from 'mongodb';
import logger from './logger';

export class ValidationHelper {
  static isValidObjectId(id: string): boolean {
    logger.warn(
      `ValidationHelper.isValidObjectId called with: ${id} (type: ${typeof id})`,
    );

    if (!id || typeof id !== 'string') {
      logger.warn(
        `Validation failed - invalid input: id=${id}, type=${typeof id}`,
      );
      return false;
    }

    try {
      const isValid = ObjectId.isValid(id);
      logger.warn(`ObjectId.isValid(${id}) = ${isValid}`);
      return isValid;
    } catch (error) {
      logger.error(`Error in ObjectId validation: ${error}`);
      return false;
    }
  }
}
