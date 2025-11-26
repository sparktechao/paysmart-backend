import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    // Usar IP do usuário como tracker
    return req.ips?.length ? req.ips[0] : req.ip || 'unknown';
  }
} 