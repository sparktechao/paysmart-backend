import { Controller, Get, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ValidationsService } from './validations.service';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('validations')
@Controller('validations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Listar validações pendentes para o usuário premium' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de validações pendentes' 
  })
  async getPendingValidations(@Req() req: Request) {
    const userId = req.user['id'];
    return this.validationsService.getPendingValidations(userId);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Listar validações solicitadas pelo usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de validações solicitadas' 
  })
  async getMyValidationRequests(@Req() req: Request) {
    const userId = req.user['id'];
    return this.validationsService.getMyValidationRequests(userId);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Aprovar validação de usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Validação aprovada com sucesso' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Validação não encontrada' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Usuário não tem permissão para aprovar' 
  })
  async approveValidation(
    @Req() req: Request,
    @Param('id') validationId: string,
    @Body() data: { notes?: string }
  ) {
    const validatorId = req.user['id'];
    return this.validationsService.approveValidation(validationId, validatorId, data.notes);
  }

  @Put(':id/reject')
  @ApiOperation({ summary: 'Rejeitar validação de usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Validação rejeitada com sucesso' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Validação não encontrada' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Usuário não tem permissão para rejeitar' 
  })
  async rejectValidation(
    @Req() req: Request,
    @Param('id') validationId: string,
    @Body() data: { notes: string }
  ) {
    const validatorId = req.user['id'];
    return this.validationsService.rejectValidation(validationId, validatorId, data.notes);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de validações do usuário premium' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estatísticas de validações' 
  })
  async getValidationStats(@Req() req: Request) {
    const userId = req.user['id'];
    return this.validationsService.getValidationStats(userId);
  }
}