import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SharedWalletsService } from './shared-wallets.service';
import { 
  CreateSharedWalletDto, 
  SharedWalletResponseDto,
  AddMemberDto,
  UpdateMemberDto,
  SharedWalletFilterDto
} from './dto/shared-wallets.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('shared-wallets')
@Controller('shared-wallets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SharedWalletsController {
  constructor(private readonly sharedWalletsService: SharedWalletsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar carteira compartilhada' })
  @ApiResponse({ 
    status: 201, 
    description: 'Carteira compartilhada criada com sucesso',
    type: SharedWalletResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async createSharedWallet(
    @Req() req: Request,
    @Body() createSharedWalletDto: CreateSharedWalletDto
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.createSharedWallet({
      name: createSharedWalletDto.name,
      description: createSharedWalletDto.description,
      walletId: '', // TODO: Implement wallet creation
      ownerId: userId,
      members: createSharedWalletDto.members.map(member => ({
        userId: member.userId,
        role: member.role as 'ADMIN' | 'MEMBER',
        permissions: {
          canSend: member.permissions.includes('DEPOSIT' as any),
          canReceive: member.permissions.includes('WITHDRAW' as any),
          canView: member.permissions.includes('VIEW' as any),
          canManage: member.permissions.includes('MANAGE_MEMBERS' as any),
        },
      })),
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar carteiras compartilhadas do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de carteiras compartilhadas',
    type: [SharedWalletResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserSharedWallets(
    @Req() req: Request,
    @Query() _filter: SharedWalletFilterDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.sharedWalletsService.getUserSharedWallets(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter carteira compartilhada por ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Carteira compartilhada encontrada',
    type: SharedWalletResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Carteira compartilhada não encontrada' })
  async getSharedWalletById(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.getSharedWalletById(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar carteira compartilhada' })
  @ApiResponse({ 
    status: 200, 
    description: 'Carteira compartilhada atualizada com sucesso',
    type: SharedWalletResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Carteira compartilhada não encontrada' })
  @ApiResponse({ status: 403, description: 'Sem permissão para atualizar' })
  async updateSharedWallet(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateData: Partial<CreateSharedWalletDto>
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.updateSharedWallet(id, userId, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar carteira compartilhada' })
  @ApiResponse({ status: 204, description: 'Carteira compartilhada deletada com sucesso' })
  @ApiResponse({ status: 404, description: 'Carteira compartilhada não encontrada' })
  @ApiResponse({ status: 403, description: 'Sem permissão para deletar' })
  async deleteSharedWallet(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<void> {
    const userId = req.user['id'];
    return this.sharedWalletsService.deleteSharedWallet(id, userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Adicionar membro à carteira compartilhada' })
  @ApiResponse({ 
    status: 201, 
    description: 'Membro adicionado com sucesso',
    type: SharedWalletResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Carteira compartilhada não encontrada' })
  @ApiResponse({ status: 403, description: 'Sem permissão para adicionar membros' })
  async addMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() addMemberDto: AddMemberDto
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.addMember(id, userId, {
      newMemberId: addMemberDto.newMemberId,
      role: addMemberDto.role as 'ADMIN' | 'MEMBER',
      permissions: addMemberDto.permissions,
    });
  }

  @Put(':id/members/:memberId')
  @ApiOperation({ summary: 'Atualizar membro da carteira compartilhada' })
  @ApiResponse({ 
    status: 200, 
    description: 'Membro atualizado com sucesso',
    type: SharedWalletResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Carteira compartilhada ou membro não encontrado' })
  @ApiResponse({ status: 403, description: 'Sem permissão para atualizar membros' })
  async updateMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberDto: UpdateMemberDto
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.updateMember(id, memberId, userId, {
      role: updateMemberDto.role as 'ADMIN' | 'MEMBER',
      permissions: updateMemberDto.permissions,
    });
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover membro da carteira compartilhada' })
  @ApiResponse({ status: 204, description: 'Membro removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Carteira compartilhada ou membro não encontrado' })
  @ApiResponse({ status: 403, description: 'Sem permissão para remover membros' })
  async removeMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('memberId') memberId: string
  ): Promise<void> {
    const userId = req.user['id'];
    return this.sharedWalletsService.removeMember(id, memberId, userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Listar membros da carteira compartilhada' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de membros',
    type: [SharedWalletResponseDto] 
  })
  async getMembers(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const userId = req.user['id'];
    return this.sharedWalletsService.getMembers(id, userId);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Obter transações da carteira compartilhada' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transações da carteira compartilhada'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSharedWalletTransactions(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.sharedWalletsService.getSharedWalletTransactions(id, userId, page, limit);
  }

  @Post(':id/deposit')
  @ApiOperation({ summary: 'Fazer depósito na carteira compartilhada' })
  @ApiResponse({ 
    status: 201, 
    description: 'Depósito realizado com sucesso',
    type: SharedWalletResponseDto 
  })
  async deposit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() depositData: { amount: number; description?: string }
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.deposit(id, userId, depositData);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Fazer saque da carteira compartilhada' })
  @ApiResponse({ 
    status: 201, 
    description: 'Saque realizado com sucesso',
    type: SharedWalletResponseDto 
  })
  async withdraw(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() withdrawData: { amount: number; description?: string }
  ): Promise<SharedWalletResponseDto> {
    const userId = req.user['id'];
    return this.sharedWalletsService.withdraw(id, userId, withdrawData);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de carteiras compartilhadas' })
  @ApiResponse({ status: 200, description: 'Estatísticas das carteiras compartilhadas' })
  async getSharedWalletStats(
    @Req() req: Request,
    @Query() filter: SharedWalletFilterDto
  ) {
    const userId = req.user['id'];
    return this.sharedWalletsService.getSharedWalletStats(userId, filter);
  }
}
