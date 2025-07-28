import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'PaySmart Premium API - Revolucionando o mercado de carteiras digitais em Angola 🇦🇴';
  }
}
