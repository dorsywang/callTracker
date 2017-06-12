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

var types = require('babel-types');
var babylon = require('babylon');
var traverse = require('babel-traverse').default;

var deepPropery = function(obj, path){
    path = path.split(".");

    var r = obj, p;
    while((p = path.shift()) && (r = r[p]));

    return r;
};

var getFunctionExpressionReference = function(path){
    return deepPropery(path, "parent.id.name");
};

var getReferenceName = function(path){
    return deepPropery(path, "id.name") || deepPropery(path, "node.id.name")
};


class CallTracker{
    constructor(){
        this.treeResult = new Map()
        this.calledMap = new Map();

        var codes = fs.readFileSync('./test/index.js', {encoding: 'utf-8'});

        this.parseAST(codes);

        this.getFunctionCallRefMap();
        this.getRefCalledByRefMap();

        this.getCalledRelationShip();
    }

    parseAST(codes){
        var ast = babylon.parse(codes, {
            sourceType: "module",
            plugins: [
                'jsx',
                'estree'
            ]
        });

        this.ast = ast;

        console.log('Code AST:', ast);
    }
    
    getRefCalledByRefMap(){
        var treeResult = this.treeResult;
        var calledMap = this.calledMap;

        traverse(this.ast, {
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

                // 分析调用function
                var callingName = node.callee.name;

                // 找到父级function
                var funcPaths = path.findParent((path) => path.isFunctionExpression());
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

                var callingFunctionName = getReferenceName(callingFunctionReferencePath);
                var selfReferenceName = getFunctionExpressionReference(funcPaths);

                console.log("finding Relationship: ", selfReferenceName, '-->', callingName);

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

    getCalledRelationShip(){
        var calledMap = this.calledMap;

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
            console.log(r);

            var name = getReferenceName(i);


            //console.log('calling', i, calledMap.get(i));
        }

    }
}


new CallTracker();
