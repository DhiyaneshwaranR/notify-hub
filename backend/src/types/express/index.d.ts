declare namespace Express {
    export interface Request {
        user?: any; // We'll type this properly when we add authentication
    }
}