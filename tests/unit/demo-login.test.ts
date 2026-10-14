import test from "node:test";
import assert from "node:assert/strict";
import {isDemoAdminLogin} from "../../src/domain/demo-login.ts";
import {loginUserSchema} from "../../src/domain/login-user.ts";

test("public demo login accepts requested pair without changing real account password rules",()=>{
 assert.equal(isDemoAdminLogin("admin","admin"),true);
 assert.equal(isDemoAdminLogin(" ADMIN ","admin"),true);
 for(const [id,password] of [["admin","Admin"],["admin","admin "],["operator","admin"],["admin","real-password"],[null,"admin"],["admin",null]])assert.equal(isDemoAdminLogin(id,password),false);
 assert.equal(loginUserSchema.safeParse({userId:"admin",name:"管理者",password:"admin",role:"admin"}).success,false);
 assert.equal(loginUserSchema.safeParse({userId:"admin",name:"管理者",password:"password8",role:"admin"}).success,true);
});
