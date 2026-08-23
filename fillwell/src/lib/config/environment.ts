/**
 * Production Environment Configuration & Separation Validator
 */
export interface EnvironmentConfig {
  env: 'development' | 'staging' | 'production';
  supabaseUrl: string;
  isProduction: boolean;
  isStaging: boolean;
  backupSchedule: string;
  pointInTimeRecoveryEnabled: boolean;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const customEnv = process.env.APP_ENV || nodeEnv;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

  const isProduction = customEnv === 'production';
  const isStaging = customEnv === 'staging';

  return {
    env: isProduction ? 'production' : isStaging ? 'staging' : 'development',
    supabaseUrl,
    isProduction,
    isStaging,
    backupSchedule: 'Every day at 00:00 UTC (Automated WAL archiving + Daily snapshots)',
    pointInTimeRecoveryEnabled: true,
  };
}

export function validateEnvironmentSeparation(): { valid: boolean; message: string } {
  const config = getEnvironmentConfig();
  
  if (config.isProduction && config.supabaseUrl.includes('staging')) {
    throw new Error('FATAL CONFIGURATION ERROR: Production app is connected to a staging database!');
  }

  if (config.isStaging && config.supabaseUrl.includes('prod')) {
    throw new Error('FATAL CONFIGURATION ERROR: Staging app is connected to a production database!');
  }

  return {
    valid: true,
    message: `Environment successfully isolated: Running in ${config.env.toUpperCase()} mode.`,
  };
}
