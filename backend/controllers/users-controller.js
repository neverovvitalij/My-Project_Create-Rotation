const { validationResult } = require('express-validator');
const ApiError = require('../exceptions/api-error');
const userService = require('../services/user-service');

class UserController {
  async registration(req, res, next) {
    try {
      const errors = validationResult(req);
      console.log(errors.array());
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation Error', errors.array()));
      }
      const { email, password } = req.body;
      const userData = await userService.registration(email, password);
      res.cookie('refreshToken', userData.refreshToken, {
        maxAge: 30 * 24 * 60 * 1000,
        httpOnly: true,
      });
      return res.json(userData);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const userData = await userService.login(email, password);
      res.cookie('refreshToken', userData.refreshToken, {
        axAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });
      return res.json(userData);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.cookies;
      const token = await userService.logout(refreshToken);
      res.clearCookie('refreshToken');
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
      res.cookie('refreshToken', userData.refreshToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });
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
