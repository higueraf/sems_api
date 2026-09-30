import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PersonsService } from '../persons/persons.service';
import { MailService } from '../mail/mail.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private personsService: PersonsService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email, isActive: true },
      select: ['id', 'email', 'password', 'firstName', 'lastName', 'role', 'isActive'],
    });

    if (!user || !(await user.validatePassword(dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo. Inicia sesión.');
    }

    const user = await this.userRepo.save(this.userRepo.create({
      email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.AUTHOR,
      isActive: true,
    }));

    const person = await this.personsService.findOrCreate({
      fullName: `${dto.firstName} ${dto.lastName}`,
      email,
    });
    await this.personsService.setUserId(person.id, user.id);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  /**
   * Genera un token de recuperación y envía el correo. Siempre responde con
   * éxito (exista o no la cuenta) para no filtrar qué correos están registrados.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.findOne({ where: { email, isActive: true } });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await this.userRepo.update(user.id, {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: expires,
      });

      const frontendUrls = (this.config.get<string>('frontendUrl') || 'http://localhost:5173')
        .split(',').map(u => u.trim());
      const frontendUrl = frontendUrls.find(u => u.startsWith('https://')) ?? frontendUrls[0];
      const resetUrl = `${frontendUrl}/restablecer-contrasena?token=${rawToken}`;

      this.mailService
        .sendPasswordReset({ email: user.email, fullName: user.fullName }, resetUrl)
        .catch(() => false);
    }

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .addSelect('u.resetPasswordTokenHash')
      .where('u.resetPasswordTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado');
    }

    user.password = dto.newPassword;
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await this.userRepo.save(user);

    return { success: true };
  }
}
