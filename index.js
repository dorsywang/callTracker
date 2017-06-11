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

var codes = fs.readFileSync('./test/index.js', {encoding: 'utf-8'});

var ast = babylon.parse(codes, {
    sourceType: "module",
    plugins: [
        'jsx',
        'estree'
    ]
});

console.log(ast);

var treeResult = new Map();

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
    return deepPropery(path, "path.node.id.name")
};


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

        var callingFunction = findScope(path.scope, callingName);

        var callingFunctionName = getReferenceName(callingFunction);
        var selfReferenceName = getFunctionExpressionReference(funcPaths);

        console.log("finding Relationship: ", selfReferenceName, '-->', callingName);

        if(! treeResult.get(callingFunction)){
            treeResult.set(callingFunction, []);
        }

        // reference A -> [Funciton, Function]   called by->[Function, Function]
        treeResult.get(callingFunction).push(funcPaths);
    }
  }
});

for(var i of treeResult.keys()){
    // 分析树
    var analizeTrackers = function(path){
        var result = [];
        var calledTrackers = treeResult.get(path) || [];

        console.log(pathName, getReferenceName(path), getFunctionExpressionReference(path));

        calledTrackers.map(item => {
            console.log(pathName, getReferenceName(item), getFunctionExpressionReference(item));

            var called = analizeTrackers(item);


            if(called && called.length){
                called.map(i => {
                    i.unshift(item);
                });

                result.push(called);
            }else{
                result.push([item]);
            }

        });

        return result;
    };

    var r = analizeTrackers(i);
    console.log(r);

    var name = i.path.node.id.name;


    console.log('calling', i, treeResult.get(i));
}

//console.log(ast);

