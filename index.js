/**
 *
 *
 * calling tree is like this 
 * reference A-> Function -> [reference B, reference C...]
 *
 * reference B-> Function -> [refrence D...]
 * 
 * we want to get A->B->C
 */
var fs = require('fs');

var babel = require('babel-core');
var types = require('babel-types');
var babylon = require('babylon');
var traverse = require('babel-traverse').default;
var template = require('babel-template');
var gen = require('babel-generator').default;

var deepPropery = function(obj, path){
    path = path.split(".");

    var r = obj, p;
    while((p = path.shift()) && (r = r[p]));

    return r;
};

var getFunctionExpressionReference = function(path){
    // functionExpress get Reference
    return deepPropery(path, "parent.id.name");
};

var getReferenceName = function(path){
    return deepPropery(path, "id.name") || deepPropery(path, "node.id.name")
};

var getFunctionName = function(path){
    return deepPropery(path, 'node.id.name');
}

function addComment(node, type, content, line) {
  addComments(node, type, [{
    type: line ? "CommentLine" : "CommentBlock",
    value: content
  }]);
}

function addComments(node, type, comments) {
  if (!comments) return;

  if (!node) return;

  var key = type + "Comments";

  if (node[key]) {
    node[key] = node[key].concat(comments);
  } else {
    node[key] = comments;
  }
}


class CallTracker{
    constructor(){
        this.treeResult = new Map()
        this.calledMap = new Map();
        this.finalResult = new Map();
        this.callOperator = '-->';

        var codes = fs.readFileSync('./test/index.js', {encoding: 'utf-8'});

        this.parseAST(codes);

        this.getFunctionCallRefMap();
        this.getRefCalledByRefMap();

        this.getCalledRelationShip();

        this.addTrackerAsCommentForCodes();

        var code = gen(this.ast, {
            comments: true
        });

        console.log(code.code);

    }

    parseAST(codes){
        var ast = babylon.parse(codes, {
        });

        this.ast = ast;

        console.log('Code AST:', ast);
    }

    addTrackerAsCommentForCodes(){
        var finalResult = this.finalResult;
       traverse(this.ast, {
         FunctionDeclaration: {
                enter(path){
                    var node = path.node;

                    var id = node.id;

                    var calledString = finalResult.get(node);

                    if(calledString){
                        var comment = `${calledString}`;

                        /*
                        var ast = babylon.parse(comment, {
                            type: 'script'
                        });
                        console.log('babylonPase', ast);

                        var gen1 = babel.template(comment);
                        var ast = gen1({});
                        */

                        //path.parentPath.addComment("leading", comment);

                        var noopNode = types.noop();

                        path.insertBefore(noopNode);

                        addComment(noopNode, "leading", comment);


                    }
                }
            },

            VariableDeclarator: {
                enter(path){
                    var node = path.node;

                    var id = node.id;
                    var init = node.init;

                    if(types.isFunctionExpression(init)){
                        var calledString = finalResult.get(node);

                        if(calledString){
                            var comment = `${calledString}`;

                            /*
                            var ast = babylon.parse(comment, {
                                type: 'script'
                            });
                            console.log('babylonPase', ast);

                            var gen1 = babel.template(comment);
                            var ast = gen1({});
                            */

                            //path.parentPath.addComment("leading", comment);

                            var noopNode = types.noop();

                            path.parentPath.insertBefore(noopNode);

                            addComment(noopNode, "leading", comment);


                        }
                    }
                }
            }
       });
    }
    
    getRefCalledByRefMap(){
        var treeResult = this.treeResult;
        var calledMap = this.calledMap;

        traverse(this.ast, {
            // function(){}
            FunctionDeclaration: {
                enter(path){
                    var node = path.node;

                    var id = node.id;
                    //var init = node.init;

                   // if(types.isFunctionExpression(init)){

                        // Function -> [reference A,...]
                        var callingReferences = treeResult.get(node) || [];

                        console.log('get callingReferences', callingReferences);

                        callingReferences.map(item => {
                            // calledMap[reference A] = [...]
                            if(! calledMap.get(item)){
                                calledMap.set(item, []);
                            }

                            // reference this -> function -> A -> function
                            // calledMap[reference A] = [reference this]
                            calledMap.get(item).push(node);
                        });
                    //}
                }
            },
            
            // var a = function(){}
            VariableDeclarator: {
                enter(path){
                    var node = path.node;

                    var id = node.id;
                    var init = node.init;

                    if(types.isFunctionExpression(init)){
                        console.log('declarator path\'s init is functionExpression', path, 'id:', id.name);

                        // Function -> [reference A,...]
                        var callingReferences = treeResult.get(init) || [];

                        console.log('get callingReferences', callingReferences);

                        callingReferences.map(item => {
                            // calledMap[reference A] = [...]
                            if(! calledMap.get(item)){
                                calledMap.set(item, []);
                            }

                            // reference this -> function -> A -> function
                            // calledMap[reference A] = [reference this]
                            calledMap.get(item).push(node);
                        });
                    }
                }
            }
        });

    }

    getFunctionCallRefMap(){
        var ast = this.ast;
        var treeResult = this.treeResult;
        var calledMap = this.calledMap;

        traverse(ast, {
          // get Function -> [Reference A, Reference B...]
          CallExpression: {
            enter(path){
                let node = path.node;
                // 这里是调用代码
                //console.log(path);

                if(! types.isIdentifier(node.callee)){
                    //var a = node.callee.evaluate()
                    //console.log('a', a);
                    return;
                }

                // 分析调用function
                var callingName = node.callee.name;

                // 找到父级function
                var funcPaths = path.findParent((path) => path.isFunctionExpression() ||  path.isFunctionDeclaration());

                if(! funcPaths){
                    return;
                }

                var funcNode = funcPaths.node;



                // 从scope中找出是哪个function为调用者
                var findScope = function(scope, name){
                    if(scope.bindings[name]){
                        return scope.bindings[name];
                    }else{
                        if(scope.parent){
                            return findScope(scope.parent, name);
                        }else{
                            return null;
                        }
                    }
                };

                var callingFunctionReference = findScope(path.scope, callingName);
                var callingFunctionReferencePath = callingFunctionReference.path;
                var callingFunctionReferenceNode = callingFunctionReferencePath.node;

                var nodeType = callingFunctionReferencePath.node.type;

                if(nodeType === 'FunctionExpression'){
                    var callingFunctionName = getReferenceName(callingFunctionReferencePath);
                }else if(nodeType === 'FunctionDeclaration'){
                    var callingFunctionName = getFunctionName(callingFunctionReferencePath);
                }

                var selfReferenceName = getFunctionExpressionReference(funcPaths) || getFunctionName(funcPaths);

                console.log("finding Relationship: ", selfReferenceName, '-->', callingFunctionName);

                if(! treeResult.get(funcNode)){
                    treeResult.set(funcNode, []);
                }

                // reference A -> [Funciton, Function]   called by->[Function, Function]
                //treeResult.get(callingFunction).push(funcPaths);

                // Function -> [reference A, reference B, ...]
                treeResult.get(funcNode).push(callingFunctionReferenceNode);
                console.log('functionPath', funcPaths);
            }
          }
        });
    }

    transformToString(relation, selfName){
        return relation.map(item => {
            return item.map(i => {
                return getReferenceName(i);
            }).reverse().join(this.callOperator) + this.callOperator + selfName;
        }).join('\n');
    }

    getCalledRelationShip(){
        var calledMap = this.calledMap;
        var finalResult = this.finalResult;

        for(var i of calledMap.keys()){
            console.log('start to get callPath');
            // 分析树
            var analizeTrackers = function(node){
                var result = [];
                var calledTrackers = calledMap.get(node) || [];

                //console.log('referenceName', getReferenceName(node));

                var nodeReferenceName = getReferenceName(node);

                calledTrackers.map(item => {
                    //console.log('referenceName', getReferenceName(item));

                    var referName = getReferenceName(item);

                    var called = analizeTrackers(item);


                    if(called && called.length){
                        called.map(i => {
                            i.unshift(item);

                            result.push(i);
                        });

                    }else{
                        result.push([item]);
                    }

                });

                return result;
            };

            var r = analizeTrackers(i);

            var name = getReferenceName(i);

            var relationString = this.transformToString(r, name);
            console.log('relationString', relationString);

            finalResult.set(i, relationString);

            //console.log('calling', i, calledMap.get(i));
        }

    }
}


new CallTracker();
