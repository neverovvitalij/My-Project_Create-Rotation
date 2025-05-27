const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/user-model');
const mailService = require('../services/mail-service');
const tokenService = require('../services/token-service');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');

class UserService {
  async registration(email, password, role, costCenter, shift) {
    const candidate = await UserModel.findOne({ email });
    if (candidate) {
      throw ApiError.BadRequest(`User ${email} is already registered`);
    }

    const hashedPassword = await bcrypt.hash(password, 5);
    const userActivationLink = uuidv4();
    const adminActivationLink = uuidv4();

    const user = await UserModel.create({
      email,
      password: hashedPassword,
      role,
      costCenter,
      activationLink: userActivationLink,
      adminActivationLink,
      shift,
    });

    await mailService.sendActivationMail(
      email,
      `${process.env.API_URL}/api/activate/user/${userActivationLink}`,
      process.env.ADMIN_EMAIL,
      `${process.env.API_URL}/api/activate/admin/${adminActivationLink}`
    );

    const userDto = new UserDto(user);
    const tokens = tokenService.generateToken({ ...userDto });
    await tokenService.saveToken(userDto.id, tokens.refreshToken);

    return { ...tokens, user: userDto };
  }

  async activate(type, activationLink) {
    let user;
    if (type === 'user') {
      user = await UserModel.findOne({ activationLink });
      if (!user) {
        throw ApiError.BadRequest('Invalid user activation link');
      }
      user.userActivationStatus = true;
    } else if (type === 'admin') {
      user = await UserModel.findOne({ adminActivationLink: activationLink });
      if (!user) {
        throw ApiError.BadRequest('Invalid administrator activation link');
      }
      user.adminActivationStatus = true;
    } else {
      throw ApiError.BadRequest('Invalid activation type');
    }

    // The account is activated only if both have confirmed
    if (user.userActivationStatus && user.adminActivationStatus) {
      user.isActivated = true;
    }

    await user.save();
  }

  async login(email, password) {
    const user = await UserModel.findOne({ email });
    if (!user) {
      throw ApiError.BadRequest(`User ${email} was not found!`);
    }
    const isPassEquals = await bcrypt.compare(password, user.password);
    if (!isPassEquals) {
      throw ApiError.BadRequest('Incorrect password');
    }
    const userDto = new UserDto(user);
    const tokens = tokenService.generateToken({ ...userDto });

    await tokenService.saveToken(userDto.id, tokens.refreshToken);

    return { ...tokens, user: userDto };
  }

  async logout(refreshToken) {
    const token = await tokenService.removeToken(refreshToken);
    return token;
  }

  async refresh(refreshToken) {
    if (!refreshToken) {
      console.error('Refresh token is missing');
      throw ApiError.UnauthorizedError();
    }
    const userData = tokenService.validateRefreshToken(refreshToken);
    const tokenFromDb = await tokenService.findToken(refreshToken);

    if (!userData || !tokenFromDb) {
      console.error('Token validation failed');
      throw ApiError.UnauthorizedError;
    }
    const user = await UserModel.findById(userData.id);
    const userDto = new UserDto(user);
    const tokens = tokenService.generateToken({ ...userDto });

    await tokenService.saveToken(userDto.id, tokens.refreshToken);

    return { ...tokens, user: userDto };
  }

  async requestPasswordReset(email) {
    try {
      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        return {
          success: false,
          message: 'User was not found.',
        };
      }

      const token = tokenService.generatePasswordResetToken({ id: user._id });
      const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;

      await mailService.sendPasswordResetMail(email, resetLink);
      console.log(`Password reset link sent to ${email}: ${resetLink}`);

      return { success: true, message: 'Password reset link has been sent.' };
    } catch (error) {
      console.error('Error resetting password:', error);
      throw ApiError.InternalServerError('Error resetting password');
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const userData = tokenService.validatePasswordResetToken(token);
      if (!userData) {
        return {
          success: false,
          message: 'Invalid or expired token.',
        };
      }
      const user = await UserModel.findById(userData.id);
      if (!user) {
        return { success: false, message: 'User was not found.' };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 5);
      user.password = hashedPassword;

      await user.save();

      return {
        success: true,
        message: 'Password was successfully reset.',
      };
    } catch (error) {
      console.error('Error changing password:', error);
      throw ApiError.InternalServerError('Error changing password');
    }
  }
}

module.exports = new UserService();
