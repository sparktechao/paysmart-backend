import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): string {
    // Usar IP do usuário como tracker
    return req.ips.length ? req.ips[0] : req.ip;
  }
} 