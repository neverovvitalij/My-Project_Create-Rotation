const Router = require('express').Router;
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');
const usersController = require('../controllers/users-controller');
const rotationplanController = require('../controllers/rotationplan-controler');
const stationsController = require('../controllers/stations-contoller');
const workersController = require('../controllers/workers-controller');

const router = new Router();

//Pages
router.post(
  '/registration',
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 32 }),
  usersController.registration
);
router.post('/login', usersController.login);
router.post('/logout', usersController.logout);
router.get('/refresh', usersController.refresh);
router.post('/request-reset-password', usersController.requestPasswordReset);
router.post('/reset-password', usersController.resetPassword);

//Services
router.get('/activate/:type/:link', usersController.activate);
router.get('/workers', authMiddleware, workersController.getWorkers);
router.post('/add-worker', workersController.addWorker);
router.patch('/change-worker-status', workersController.workerChangeStatus);
router.patch('/change-station-status', stationsController.stationChangeStatus);
router.patch(
  '/worker/:name/station-to-delete',
  workersController.removeStationFromWorker
);
router.patch(
  '/worker/:name/station-to-add',
  workersController.addStationToWorker
);
router.delete('/delete-worker', workersController.deleteWorker);
router.post('/daily-rotation', rotationplanController.getDailyRotation);
router.post('/confirm-rotation', rotationplanController.confirmRotation);
router.get(
  '/download-latest-confirmed-rotation',
  rotationplanController.downloadConfirmedRotation
);
router.get('/stations', stationsController.getStations);
router.post('/new-station', stationsController.addStation);
router.delete('/delete-station', stationsController.deleteStation);

module.exports = router;
