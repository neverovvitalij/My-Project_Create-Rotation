// import AoModel from '../models/ao-model';
// import WorkerModel from '../models/worker-model';

// class AoTaskService {
//   async generateAoTaskRotation(costCenter, shift, plant) {
//     // Fetch all active workers for the given costCenter/shift/plant

//     let activeWorkersFromDB = [];
//     let aoTaskFromDB = [];

//     try {
//       activeWorkersFromDB = await WorkerModel.find({
//         costCenter,
//         shift,
//         plant,
//       });

//       aoTaskFromDB = await AoModel.find({
//         costCenter,
//         shift,
//         plant,
//       });
//     } catch (error) {
//       console.error('Error fetch all active Workers/AO:', error.message);
//       throw new Error('Failed to fetch all active Workers/AO');
//     }
//   }
// }

// module.exports = AoTaskService;
