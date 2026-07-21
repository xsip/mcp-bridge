export class HealthResponseDto {
  status!: 'ok';
  uptime!: number;
  connectedClients!: number;
  version!: string;
  timestamp!: string;
}
