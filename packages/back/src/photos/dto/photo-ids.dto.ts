import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/**
 * Shared DTO for endpoints that accept a batch of photo IDs under the
 * `ids` key (trash restore / permanent delete).
 */
export class PhotoIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids!: string[];
}

/**
 * Variant for the legacy `photoIds` payload shape used by the gallery
 * bulk-delete endpoint. Same constraints, different field name.
 */
export class BulkPhotoIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  photoIds!: string[];
}
