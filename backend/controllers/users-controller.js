const { validationResult } = require('express-validator');
const ApiError = require('../exceptions/api-error');
const userService = require('../services/user-service');

const isProd = process.env.NODE_ENV === 'production';
const refreshCookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 1000,
};
class UserController {
  async registration(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation Error', errors.array()));
      }
      const { email, password, role, costCenter, shift, plant } = req.body;
      const userData = await userService.registration(
        email,
        password,
        role,
        costCenter,
        shift,
        plant
      );
      res.cookie('refreshToken', userData.refreshToken, refreshCookieOpts);
      return res.json(userData);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const userData = await userService.login(email, password);
      res.cookie('refreshToken', userData.refreshToken, refreshCookieOpts);
      return res.json(userData);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.cookies;
      const token = await userService.logout(refreshToken);
      res.clearCookie('refreshToken', {
        ...refreshCookieOpts,
        maxAge: undefined,
      });
      return res.json(token);
    } catch (error) {
      next(error);
    }
  }

  async activate(req, res, next) {
    try {
      const { type, link } = req.params;
      await userService.activate(type, link);
      return res.redirect(process.env.CLIENT_URL);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.cookies;
      const userData = await userService.refresh(refreshToken);
      res.cookie('refreshToken', userData.refreshToken, refreshCookieOpts);
      return res.json(userData);
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;
      const response = await userService.requestPasswordReset(email);
      return res.json(response);
    } catch (error) {
      console.error('Error in controller (requestPasswordReset):', error);
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const response = await userService.resetPassword(token, newPassword);
      return res.json(response);
    } catch (error) {
      console.error('Error in controller (resetPassword):', error);
      next(error);
    }
  }
}

module.exports = new UserController();
