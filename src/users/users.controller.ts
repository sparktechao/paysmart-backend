import { 
  Controller, 
  Get, 
  Put, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { 
  RequestValidationDto, 
  ValidateUserDto, 
  UpdateUserDto, 
  UserResponseDto,
  ValidationRequestDto 
} from './dto/users.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil do usuário', type: UserResponseDto })
  async getProfile(@Req() req: Request): Promise<UserResponseDto> {
    const userId = req.user['id'];
    return this.usersService.findById(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Atualizar perfil do usuário' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso', type: UserResponseDto })
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const userId = req.user['id'];
    return this.usersService.updateUser(userId, updateUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter usuário por ID' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Get('phone/:phone')
  @ApiOperation({ summary: 'Obter usuário por telefone' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async getUserByPhone(@Param('phone') phone: string): Promise<UserResponseDto> {
    return this.usersService.findByPhone(phone);
  }

  @Post('request-validation')
  @ApiOperation({ summary: 'Solicitar validação peer-to-peer' })
  @ApiResponse({ status: 201, description: 'Solicitação de validação enviada com sucesso' })
  @ApiResponse({ status: 400, description: 'Usuário não pode solicitar validação' })
  async requestValidation(
    @Req() req: Request,
    @Body() _requestValidationDto: RequestValidationDto,
  ): Promise<{ message: string }> {
    const userId = req.user['id'];
    return this.usersService.requestValidation({ userId });
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar usuário (apenas premium)' })
  @ApiResponse({ status: 200, description: 'Usuário validado com sucesso' })
  @ApiResponse({ status: 403, description: 'Apenas usuários premium podem validar' })
  async validateUser(
    @Req() req: Request,
    @Body() validateUserDto: ValidateUserDto,
  ): Promise<{ message: string }> {
    const validatorId = req.user['id'];
    return this.usersService.validateUser(validatorId, validateUserDto);
  }

  @Get('validation-requests')
  @ApiOperation({ summary: 'Obter solicitações de validação pendentes (apenas premium)' })
  @ApiResponse({ status: 200, description: 'Lista de solicitações de validação', type: [ValidationRequestDto] })
  async getValidationRequests(@Req() req: Request): Promise<ValidationRequestDto[]> {
    const validatorId = req.user['id'];
    return this.usersService.getValidationRequests(validatorId);
  }

  @Get('pending-validations')
  @ApiOperation({ summary: 'Obter validações pendentes do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de validações pendentes', type: [ValidationRequestDto] })
  async getPendingValidations(@Req() req: Request): Promise<ValidationRequestDto[]> {
    const userId = req.user['id'];
    return this.usersService.getPendingValidations(userId);
  }
} 