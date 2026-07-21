import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({ description: 'Short-lived JWT used to authenticate API requests' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived opaque token used to obtain a new access token via /auth/refresh' })
  refreshToken: string;
}
