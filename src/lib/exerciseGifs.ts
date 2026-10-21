/**
 * Equivalencias entre los ejercicios de la app y las ilustraciones animadas de ExerciseDB (abierto, sin clave):
 * figura anatómica gris sobre fondo blanco con el músculo activo resaltado. Sin mapa = ilustración vectorial de respaldo.
 */
export const EXERCISE_GIFS: Record<string, string> = {
  'Butterfly': 'v3xmPAR', // machine seated fly (pec deck)
  'Band_Pull_Apart': 'sTfvVsG', // band reverse fly
  'Face_Pull': 'wqNPGCg', // cable rear delt row (with rope)
  'pallof-press': '9pa4H5m', // band horizontal pallof press
  'cable-glute-kickback': 'HEJ6DIX', // cable kickback
  'cable-lateral-raise': 'goJ6ezq', // cable lateral raise
  'deadbug': 'iny3m5y', // dead bug
  'Barbell_Bench_Press_-_Medium_Grip': 'EIeI8Vf', // barbell bench press
  'Incline_Dumbbell_Press': 'B3Rxp6L', // Dumbbell Incline Bench Press
  'Barbell_Incline_Bench_Press_-_Medium_Grip': '3TZduzM', // barbell incline bench press
  'Dumbbell_Bench_Press': 'SpYC0Kp', // dumbbell bench press
  'Dumbbell_Flyes': 'yz9nUhF', // dumbbell fly
  'Cable_Crossover': '0CXGHya', // Cable Crossover
  'Dips_-_Chest_Version': '9WTm7dq', // chest dip
  'Machine_Bench_Press': 'DOoWcnA', // Machine Chest Press
  'Pushups': 'I4hDWkc', // push-up
  'Pullups': 'lBDjFxJ', // pull-up
  'Wide-Grip_Lat_Pulldown': 'eYnzaCm', // cable lat pulldown full range of motion
  'Bent_Over_Barbell_Row': 'eZyBC3j', // barbell bent over row
  'One-Arm_Dumbbell_Row': 'BJ0Hz5L', // Dumbbell Single-Arm Bent-Over Row
  'Seated_Cable_Rows': 'fUBheHs', // cable seated row
  'Bent_Over_Two-Dumbbell_Row': 'BJ0Hz5L', // dumbbell bent over row
  'Barbell_Deadlift': 'ila4NZS', // barbell deadlift
  'Straight-Arm_Pulldown': 'x69MAlq', // cable straight arm pulldown
  'Hyperextensions_Back_Extensions': 'zhMwOwE', // hyperextension
  'Barbell_Squat': 'qXTaZnJ', // barbell full squat
  'Front_Barbell_Squat': 'zG0zs85', // barbell front squat
  'Leg_Press': '10Z2DXU', // sled 45° leg press
  'Leg_Extensions': 'my33uHU', // Machine Leg Extension
  'Split_Squat_with_Dumbbells': 'qx4fgX7', // dumbbell single leg split squat
  'Dumbbell_Lunges': 'RRWFUcw', // dumbbell lunge
  'Hack_Squat': 'Qa55kX1', // sled hack squat
  'Goblet_Squat': 'ZA8b5hc', // kettlebell goblet squat
  'Standing_Calf_Raises': 'ykUOVze', // Machine Standing Calf Raise
  'Romanian_Deadlift': 'wQ2c4XD', // barbell romanian deadlift
  'Lying_Leg_Curls': '17lJ1kr', // Machine Lying Leg Curl
  'Seated_Leg_Curl': 'Zg3XY7P', // Machine Seated Leg Curl
  'Good_Morning': 'XlZ4lAC', // barbell good morning
  'Natural_Glute_Ham_Raise': 'Vvwjz6N', // glute-ham raise
  'Thigh_Abductor': 'CHpahtl', // Machine Seated Hip Abduction
  'Standing_Military_Press': 'Kyd9Rz5', // barbell standing wide military press
  'Dumbbell_Shoulder_Press': 'znQUdHY', // dumbbell seated shoulder press
  'Side_Lateral_Raise': 'DsgkuIt', // dumbbell lateral raise
  'Front_Dumbbell_Raise': '3eGE2JC', // dumbbell front raise
  'Reverse_Flyes': 'EAs3xL9', // dumbbell reverse fly
  'Arnold_Dumbbell_Press': 'eOrFCnx', // dumbbell arnold press
  'Upright_Barbell_Row': '83HoW9X', // barbell upright row
  'Dumbbell_Shrug': 'NJzBsGJ', // dumbbell shrug
  'Kettlebell_Arnold_Press': 'UM8mgyG', // kettlebell arnold press
  'Barbell_Curl': '25GPyDY', // barbell curl
  'Dumbbell_Bicep_Curl': 'NbVPDMW', // dumbbell biceps curl
  'Hammer_Curls': '2NpxjC1', // dumbbell hammer curl
  'Preacher_Curl': 'qOgPVf6', // barbell preacher curl
  'Standing_Biceps_Cable_Curl': 'BCGQ6J5', // Cable Close-Grip Curl
  'Incline_Dumbbell_Curl': 'ae9UoXQ', // dumbbell incline curl
  'Triceps_Pushdown': 'gAwDzB3', // cable triceps pushdown (v-bar)
  'EZ-Bar_Skullcrusher': 'h8LFzo9', // barbell lying triceps extension skull crusher
  'Bench_Dips': '9RT8oQW', // bench dip on floor
  'Dips_-_Triceps_Version': 'X6C6i5Y', // triceps dip
  'Standing_Dumbbell_Triceps_Extension': 'PdmaD0N', // dumbbell standing triceps extension
  'Close-Grip_Barbell_Bench_Press': 'J6Dx1Mu', // barbell close-grip bench press
  'Tricep_Dumbbell_Kickback': 'W6PxUkg', // dumbbell kickback
  'Crunches': 'TFqbd8t', // crunch floor
  'Hanging_Leg_Raise': 'I3tsCnC', // hanging leg raise
  'Ab_Roller': 'NAgVB3t', // wheel rollout
  'Cable_Crunch': '8xUv4J7', // cable seated crunch
  'Russian_Twist': 'XVDdcoj', // russian twist
  'Side_Bridge': 'RKjH6Lt', // side bridge
  'Decline_Push-Up': 'i5cEhka', // decline push-up
  'Push-Up_Wide': 'JmMVpR3', // wide hand push up
  'Bench_Press_-_With_Bands': 'khlHMqs', // band bench press
  'Inverted_Row': 'bZGHsAZ', // inverted row
  'Chin-Up': 'T2mxWqc', // chin-up
  'Two-Arm_Kettlebell_Row': 'wf24o8S', // Kettlebell Two-Arm Row
  'Bodyweight_Squat': '6YUfHPL', // quads (bodyweight squat)
  'Freehand_Jump_Squat': 'LIlE5Tn', // jump squat
  'Bodyweight_Walking_Lunge': 'IZVHb27', // walking lunge
  'Dumbbell_Squat': 'HsvHqgf', // dumbbell squat
  'Squats_-_With_Bands': 'TUZLh71', // band squat
  'Stiff-Legged_Dumbbell_Deadlift': '5eLRITT', // dumbbell stiff leg deadlift
  'Single_Leg_Glute_Bridge': 'rmEukuS', // single leg bridge with outstretched leg
  'Butt_Lift_Bridge': 'u0cNiij', // low glute bridge on floor
  'Hip_Extension_with_Bands': 'wSScovH', // band bent-over hip extension
  'One-Arm_Kettlebell_Swings': 'UHJlbu3', // kettlebell swing
  'Calf_Raise_On_A_Dumbbell': 'dPmaUaU', // dumbbell standing calf raise
  'Calf_Raises_-_With_Bands': '9JprnPh', // band single leg calf raise
  'Two-Arm_Kettlebell_Military_Press': 'blBXysN', // Kettlebell Two-Arm Military Press
  'Shoulder_Press_-_With_Bands': 'peAeMR3', // band shoulder press
  'Lateral_Raise_-_With_Bands': 'sTg7iys', // band front lateral raise
  'Reverse_Crunch': 'nCU1Ekp', // reverse crunch
  'Dumbbell_Squat_To_A_Bench': 'mnzcrIB', // dumbbell bench squat
  'Thigh_Adductor': 'oHsrypV', // Machine Seated Hip Adduction
  'Reverse_Hyperextension': 'Krmb3cB', // Machine Reverse Hyperextension
  'Leverage_Incline_Chest_Press': 'jHAnWmT', // Machine Incline Chest Press
  'Machine_Shoulder_Military_Press': '67n3r98', // Machine Shoulder Press
  'Triceps_Pushdown_-_Rope_Attachment': 'dU605di', // cable pushdown (with rope attachment)
  'Dumbbell_Step_Ups': 'aXtJhlg', // dumbbell step-up
  'Standing_Dumbbell_Calf_Raise': 'dPmaUaU', // dumbbell standing calf raise
  'Walking_Treadmill': 'y5p0H8a', // walking on incline treadmill
  'single-leg-press': 'WWD6FzI', // Sled 45 Degrees Single-Leg Press
};
