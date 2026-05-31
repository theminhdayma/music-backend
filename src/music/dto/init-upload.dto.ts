export interface InitUploadDto {
  title: string;
  genre?: string;
  filename: string;
  fileUrl: string;
  fileSize: number;
  licenseType?: string;
  parentSongId?: string;
}
